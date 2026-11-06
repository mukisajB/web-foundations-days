# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. It has 2 million registered users. On a normal day it is quiet, but when a very popular concert goes on sale, a huge crowd arrives in a few minutes and fights for a limited number of seats. The design must work for both situations, and it must never sell the same seat twice.

This document follows the framework: requirements, estimates, API, data model, architecture and trade-offs. Section 5 explains double-booking separately because it is the most important rule of the system.

## 1. Requirements

### Functional requirements
- Users can register and log in.
- Users can browse and search events (by name, date, city).
- Users can view an event and see which seats are available, with prices.
- Users can choose seats and hold them for a short time (5 minutes) while they pay.
- Users can pay for the held seats and receive tickets.
- Users can view their orders and tickets, each with a unique code (for example a QR code) for entry.
- A hold that is not paid for expires, and its seats become available again.
- For very popular events, users wait in a fair queue before they can choose seats.

### Non-functional requirements
- **Correctness (the most important):** a seat is sold to at most one person, and nobody is charged without receiving their ticket. This must hold even when thousands of people click the same seat at the same moment.
- **Speed:** event and seat-map pages load in under 1 second, and a hold request is answered in under 1 second, even during a big sale.
- **Fairness:** no one gets seats just because they refresh faster or use a bot. Queue positions are fair, and each person can only buy a limited number of tickets (4 per order).
- **Availability:** 99.9% uptime, and above all the site must stay up during on-sale moments, which are the most valuable moments for the business.
- **Scalability:** it handles about 400 times the normal traffic during a big sale, then scales back down afterwards.
- **Durability:** orders, payments and tickets are never lost.
- **Security:** all traffic uses HTTPS and passwords are stored as hashes. Card details go straight to a payment provider and are never stored by TicketHub.

## 2. Estimates

### Assumptions
- 2,000,000 registered users.
- Normal day: 50,000 visitors, each viewing 10 pages, and 5,000 tickets sold.
- Big sale: 200,000 people try to buy 20,000 seats in the first 10 minutes (600 seconds).
- Peak traffic on a normal day is 5 times the average.
- During the big sale, each person makes about 12 requests in 10 minutes: 1 event page load, about 9 seat-map refreshes and about 2 attempts to hold seats.
- A day has 86,400 seconds.

### Normal day
| Quantity | Calculation | Average | Peak (5x) |
|---|---|---|---|
| Page views per second | 50,000 x 10 = 500,000 per day; divided by 86,400 | about **5.8 / s** | about **29 / s** |
| Tickets sold per second | 5,000 per day; divided by 86,400 | about **0.06 / s** (one every 17 seconds) | about **0.3 / s** |

This is very light. One small server and one database would cope.

### Big sale
| Quantity | Calculation | Average over 10 minutes | First-minute peak (about 3x) |
|---|---|---|---|
| All requests per second | 200,000 x 12 = 2,400,000 requests; divided by 600 | about **4,000 / s** | about **12,000 / s** |
| Hold attempts per second | 200,000 x 2 = 400,000; divided by 600 | about **670 / s** | about **2,000 / s** |
| Orders per second | at most 20,000 seats / 2 seats per order = 10,000 orders; divided by 600 | at most about **17 / s** | |

### Comparison
- Requests are about **690 times** higher on average (4,000 versus 5.8 per second) and about **410 times** higher at peak (12,000 versus 29 per second).
- In about 10 minutes the sale sells 20,000 tickets, which is four days of normal sales.
- Demand is 10 times the supply: 200,000 people want 20,000 seats, so 9 out of 10 people will not get a ticket. Most of the traffic is people who will lose, so the system must say "sold out" cheaply and fairly.
- The big sale is a short spike, not steady growth. Servers sized for the spike would sit idle the rest of the year, so the design must absorb the spike by other means (a queue, a cache and auto-scaling) instead of simply buying more hardware.
- Storage is small: about 1.8 million tickets per year at about 1 KB each is under 2 GB, so storage is not a concern. The hard part is concurrency, not size.

## 3. API

Base path `/api/v1`. All bodies are JSON. Every endpoint except browsing needs `Authorization: Bearer <token>`.

| Method | Path | Description | Success status |
|---|---|---|---|
| GET | `/events` | Browse and search events (`?q=`, `?city=`, `?page=`). | 200 OK |
| GET | `/events/{id}` | Details of one event. | 200 OK |
| GET | `/events/{id}/seats` | The seat map with the status of each seat (available or not) and its price. | 200 OK |
| POST | `/events/{id}/queue` | Join the waiting room for a popular event. Returns a queue position. | 202 Accepted |
| POST | `/events/{id}/holds` | Hold chosen seats for 5 minutes. | 201 Created |
| DELETE | `/holds/{id}` | Release a hold before it expires. | 204 No Content |
| POST | `/orders` | Pay for held seats and create an order. Needs an `Idempotency-Key` header. | 201 Created |
| GET | `/me/orders` | List the current user's orders. | 200 OK |
| GET | `/me/tickets` | List the current user's tickets with their entry codes. | 200 OK |

### Hold seats: `POST /events/7/holds`

Request:

```json
{ "seat_ids": [1201, 1202] }
```

Response `201 Created`:

```json
{
  "hold_id": "h_8f3a2c",
  "event_id": 7,
  "seat_ids": [1201, 1202],
  "expires_at": "2027-01-15T10:05:00Z"
}
```

If any seat is already taken: `409 Conflict`, nothing is held, and the body names the unavailable seats.

### Pay: `POST /orders`

Request (header `Idempotency-Key: 3b1f...`):

```json
{ "hold_id": "h_8f3a2c", "payment_token": "tok_visa_123" }
```

Response `201 Created`:

```json
{
  "order_id": 5501,
  "status": "paid",
  "total_cents": 10000,
  "tickets": [
    { "seat_id": 1201, "code": "TH-7K2Q-91XA" },
    { "seat_id": 1202, "code": "TH-7K2Q-91XB" }
  ]
}
```

Main errors: `400` for a bad request (for example more than 4 seats), `401` for no or an expired login, `403` when the user has no queue pass for a popular event, `404` when an event or hold does not exist, `409` when seats are taken or the hold has expired, `402` when the payment is declined, `429` when a client sends too many requests and `500` for a server error.

The `Idempotency-Key` header means that if the user double-clicks Pay or the network retries the request, the payment and the order are created only once.

## 4. Data model

Five tables: **users**, **events**, **seats**, **orders** and **tickets**. The SQL is written for SQLite so it can be tested in a playground. In PostgreSQL I would use `BIGSERIAL` ids and `TIMESTAMPTZ`.

### Relationships
- **users to orders: one-to-many.** One user places many orders, and each order belongs to one user.
- **events to seats: one-to-many.** One event has thousands of seats, and each seat row belongs to one event. The seat row is the seat for that event only.
- **events to orders: one-to-many.** One event has many orders.
- **orders to tickets: one-to-many.** One order contains one or more tickets, and each ticket belongs to one order.
- **seats to tickets: one-to-zero-or-one.** A seat has at most one ticket, which is enforced by `UNIQUE (seat_id)` in `tickets`.
- **users to seats (temporary):** `seats.held_by` records who currently holds a seat. This is what makes a hold possible.

Seats and users are connected through orders and tickets, so the buyers of an event are found by joining `seats`, `tickets`, `orders` and `users`.

### CREATE TABLE statements

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    venue      TEXT NOT NULL,
    starts_at  TIMESTAMP NOT NULL,
    on_sale_at TIMESTAMP NOT NULL,
    status     TEXT NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled', 'on_sale', 'sold_out', 'cancelled'))
);

CREATE TABLE seats (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL,
    section         TEXT NOT NULL,
    row_label       TEXT NOT NULL,
    seat_number     INTEGER NOT NULL,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'held', 'pending_payment', 'sold')),
    held_by         INTEGER,
    hold_expires_at TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (held_by)  REFERENCES users (id),
    UNIQUE (event_id, section, row_label, seat_number),
    CHECK ((status = 'available' AND held_by IS NULL)
        OR (status <> 'available' AND held_by IS NOT NULL))
);

CREATE TABLE orders (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    event_id        INTEGER NOT NULL,
    total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    idempotency_key TEXT NOT NULL,
    payment_ref     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users (id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    UNIQUE (user_id, idempotency_key)
);

CREATE TABLE tickets (
    id        INTEGER PRIMARY KEY,
    order_id  INTEGER NOT NULL,
    seat_id   INTEGER NOT NULL UNIQUE,
    code      TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (seat_id)  REFERENCES seats (id)
);

CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC);
```

Important choices:
- `seats.status` has four states: `available`, `held`, `pending_payment` and `sold`.
- `UNIQUE (event_id, section, row_label, seat_number)` makes sure a physical seat exists only once for an event.
- The `CHECK` on `seats` forbids a seat that is held or sold without an owner, and an available seat that still has an owner.
- `tickets.seat_id` is `UNIQUE`, so the database refuses a second ticket for the same seat (see section 5).
- `orders` has `UNIQUE (user_id, idempotency_key)` so a repeated payment request cannot create a second order.
- The index `idx_seats_event_status` makes "all available seats of event 7" fast, because it jumps straight to the right rows instead of scanning every seat of every event. The index `idx_orders_user` makes "my orders, newest first" fast.

## 5. How the design prevents two people buying the same seat

The rule is enforced inside the database, in four layers. Application code and caches can be wrong or slow, but the database is the single source of truth.

### Layer 1: an atomic, conditional hold
When a user picks seats, one transaction runs a single `UPDATE` that only changes seats that are really free:

```sql
BEGIN;

UPDATE seats
SET status = 'held', held_by = :user_id, hold_expires_at = :now_plus_5_minutes
WHERE event_id = :event_id
  AND id IN (:seat1, :seat2)
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < :now));

-- The application checks how many rows were changed.
-- Same as the number of seats requested: COMMIT.
-- Fewer: ROLLBACK and answer 409 Conflict (nothing is held).
```

The check and the change are one atomic statement, so there is no gap between "is it free?" and "take it". When two users hit the same seat at the same moment, the database locks that row for the first transaction. The second transaction waits, then re-checks the condition, sees `status = 'held'` and changes 0 rows, so it gets a `409`. Exactly one winner, never two. Because the transaction is all-or-nothing, a user never ends up with half of the seats they asked for.

I tested this with SQLite: user A holds seats 1 and 2 (2 rows changed), user B tries the same seats (0 rows changed), and after A's hold expires user B can take them (2 rows changed).

### Layer 2: expiring holds
A hold lasts 5 minutes. A seat whose hold has expired counts as free in the `WHERE` clause above, so correctness does not depend on a background job being on time. A worker also runs every minute to set expired holds back to `available`, which keeps the data tidy and the seat map accurate.

### Layer 3: pay only what you hold
`POST /orders` moves the seats on to payment in a transaction, but only if this same user still holds them:

```sql
BEGIN;

UPDATE seats
SET status = 'pending_payment', hold_expires_at = :now_plus_10_minutes
WHERE id IN (:seat1, :seat2)
  AND status = 'held'
  AND held_by = :user_id
  AND hold_expires_at >= :now;

-- Changed rows differ from the seat count: ROLLBACK, answer 409 "your hold expired".
-- Otherwise: INSERT INTO orders (..., status) VALUES (..., 'pending'); COMMIT;
```

Then the app calls the payment provider with the order's idempotency key. The `pending_payment` state stops the hold from expiring while the payment is in progress, so seats cannot be given to someone else halfway through paying.
- **Payment succeeds:** in one transaction, set the order to `paid`, insert one row in `tickets` for each seat and set the seats to `sold`.
- **Payment fails:** set the order to `failed` and the seats back to `available` (with `held_by` empty).

A user whose hold expired and was taken by someone else cannot pay for those seats, because the update matches 0 rows.

### Layer 4: a constraint as the final safety net
`tickets.seat_id` is `UNIQUE`. Even if there were a bug in the application code, the database would refuse to create a second ticket for the same seat:

```
UNIQUE constraint failed: tickets.seat_id
```

I tested this too. The failed insert rolls back the transaction, so no second ticket exists. This layer is reached only after payment, so if it ever fires, the order is marked `failed` and the payment is refunded automatically. Layers 1 to 3 are there so that this should never happen.

### What the cache is not allowed to do
The seat map shown to users comes from a cache and can be one or two seconds old, so a user may click a seat that has just been taken. That is acceptable, because the click only creates a hold request. The database decides, and the user receives a `409` and picks another seat. The cache is never used to decide who gets a seat.

## 6. Architecture

```
 Client (browser or mobile app)
    |
    v
 +-----+     +-----+     +---------------+
 | DNS | --> | CDN | --> | Load balancer |
 +-----+     +-----+     +---------------+
                                 |
                  +--------------+---------------+
                  |                              |
                  v                              v
        +-------------------+        +-----------------------------+
        |   Waiting room    |        |  App servers (auto-scaled,  |
        |  (virtual queue)  | -----> |  3 or more, stateless)      |
        +-------------------+  pass  +-----------------------------+
                                                 |
          +------------------+-------------------+------------------+
          |                  |                   |                  |
          v                  v                   v                  v
    +-----------+  +------------------+   +-----------+   +-------------------+
    |   Cache   |  | Primary database |   |   Queue   |   | Payment provider  |
    |  (Redis)  |  | (all seat and    |   +-----------+   |    (external)     |
    +-----------+  |  order writes)   |         |         +-------------------+
                   +------------------+         v
                          | replication   +-------------+
                          v               |   Workers   |
                   +------------------+   +-------------+
                   |  Read replicas   |
                   +------------------+
```

DNS only turns the name into an address. It is drawn first because it is the first thing the client uses.

### What each component does
- **Client:** it solves the need for a simple interface by showing events and the seat map and sending the user's choices to the API.
- **DNS:** it solves the need to find the site by name, and it lets us move servers without changing the address.
- **CDN:** it solves slow loading and server overload by serving the event pages, images, scripts and a snapshot of the seat map from locations close to users, so most of the 12,000 requests per second never reach our servers.
- **Load balancer:** it solves the single-server limit by spreading requests over many app servers and skipping any that are unhealthy.
- **Waiting room:** it solves the stampede of 200,000 people by letting in a controlled number of people at a time (about 2,000 per minute), which protects the database and gives everyone a fair turn.
- **App servers (3 or more, auto-scaled):** they solve the need to run the business logic (login, holds, orders) at scale, and because they keep no state we can add many more before the sale and remove them afterwards.
- **Cache (Redis):** it solves repeated reads of the same data by keeping event details, the seat-map snapshot, the count of seats left and the waiting-room state in fast memory.
- **Primary database:** it solves the need for one correct, durable record of every seat, order and ticket, and it is the only place where seats change state, which is how double-booking is prevented.
- **Read replicas:** they solve read load on the primary by answering browsing queries such as events and order history.
- **Queue:** it solves slow work in the request path by holding jobs (sending tickets by email, creating QR codes, expiring holds, handling payment confirmations) so users never wait for them.
- **Workers:** they solve the need to run those jobs in the background, and we can run more of them if the queue grows.
- **Payment provider (external):** it solves the need to handle card payments securely, so TicketHub never stores card details.

### How it survives the big sale
1. **Before the sale:** the event page, images and scripts are already cached on the CDN. The team adds app servers (or auto-scaling is pre-warmed) because the sale time is known in advance.
2. **At the start:** users who open the event are sent to the waiting room, a very light page. Joining costs almost nothing, even for 200,000 people. Polling every 20 seconds is about 10,000 very cheap lookups per second.
3. **Fair order:** people who join in the first 2 minutes get random positions, so refreshing faster or using a bot gives no advantage. After that, positions are first come, first served. Joining requires a login, and each user gets only one pass.
4. **Controlled entry:** the waiting room admits about 2,000 users per minute with a signed pass that expires after 5 minutes. At most about 10,000 people shop at the same time. They create about 70 hold attempts and 17 orders per second, which is easily within what one primary database can do.
5. **Cheap seat maps:** the seat map for shoppers comes from a cache or CDN snapshot refreshed every 1 to 2 seconds. Thousands of refreshes per second never touch the primary database.
6. **Sold out quickly:** a counter in Redis tracks the seats left. When it reaches zero, everyone still waiting is told "sold out" immediately, with no database work.
7. **Safe under pressure:** every seat change goes through the atomic conditional updates in section 5, so even at the busiest second nobody is double-booked.
8. **After the sale:** extra servers are removed and traffic returns to normal.

### Avoiding single points of failure
- **App servers:** at least three, in different data centres, behind a load balancer that removes unhealthy ones.
- **Load balancer, DNS and CDN:** use managed services that are already spread over many machines.
- **Primary database:** a standby copy that is promoted automatically if the primary fails, plus regular backups.
- **Read replicas:** at least two, so browsing continues if one fails.
- **Cache:** a cluster with replicas. If it fails, the app falls back to the database (slower, still correct).
- **Queue and workers:** a replicated queue that keeps jobs until a worker finishes them, and several workers.

## 7. Trade-offs

1. **Fairness and protection versus convenience (waiting room):** the waiting room keeps the site up and gives everyone a fair chance, but people must wait, and some will wait a long time and still get nothing. We accept this because without it the site would crash and the fastest bots would win. We reduce frustration by showing the queue position and a clear "sold out" message as soon as it is true.
2. **Speed versus freshness (cached seat map):** the cached seat map makes browsing fast and cheap, but it can show a seat as free when it was just taken, so some users get a `409` and must choose again. We accept this because the alternative is sending every seat-map refresh to the primary database. The database still decides, so correctness is not affected.
3. **Strong consistency versus scale (one primary for seats):** keeping all seat changes in one SQL primary gives simple and correct transactions, but it is a single write point. About 100 writes per second is well within its limits. If TicketHub grew far beyond this, we would split the data by event (each event's seats on its own database), which keeps the transactions for one event on one machine.
4. **Hold length (5 minutes):** a short hold gives more people a chance and quickly frees seats that are not paid for, but it rushes users, and a payment that takes longer can fail. A long hold is calmer but lets people lock seats and never buy. We chose 5 minutes, and extend the time for a payment that is already in progress.
5. **Cost versus readiness (auto-scaling for a spike):** extra servers for the sale cost money for a few hours, but buying for the peak all year would waste most of it, and having too little would lose the biggest sales. We scale up before known sales and back down afterwards.
