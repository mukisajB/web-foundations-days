# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10 million registered users.
- 10% of them are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- Peak traffic is 5 times the average.
- A day has 86,400 seconds, and a year has 365 days.
- Units are decimal: 1 TB = 1,000,000 MB.

**Daily active users (DAU):** 10,000,000 x 10% = **1,000,000 users per day**.

## 2. Estimates

### Uploads per second
- Uploads per day: 1,000,000 users x 1 photo = 1,000,000 photos.
- Average: 1,000,000 / 86,400 = about **12 uploads per second**.
- Peak (5x): about **58 uploads per second**.
- Upload bandwidth at peak: 58 x 2 MB = about 116 MB per second.

### Feed views per second
- Feed views per day: 1,000,000 users x 50 pages = 50,000,000 views.
- Average: 50,000,000 / 86,400 = about **579 feed views per second**.
- Peak (5x): about **2,900 feed views per second**.

### Storage per year
- Original photos per day: 1,000,000 x 2 MB = 2 TB.
- Original photos per year: 2 TB x 365 = **730 TB**.
- Thumbnails per day: 1,000,000 x 50 KB = 50 GB.
- Thumbnails per year: 50 GB x 365 = about **18 TB**.
- Total photo storage per year: about **748 TB** (roughly three quarters of a petabyte).
- Photo metadata in the database (about 1 KB per photo for owner, caption, time and file location): about 1 GB per day, or roughly 365 GB per year. This is tiny compared with the photo files.

| Quantity | Average | Peak (5x) |
|---|---|---|
| Uploads per second | 12 | 58 |
| Feed views per second | 579 | 2,900 |

## 3. Read-heavy or write-heavy?

**SnapShare is read-heavy.** There are 50 feed views for every 1 upload, a ratio of about 50 to 1. Every upload is a write, and every feed view is a read.

What this means for the design:
- Make reads cheap and fast first. Serve images from a CDN, keep hot data in a cache, and send read queries to a read replica instead of the primary database.
- Writes are rare enough (58 per second at peak) that one primary database can handle them. The write path still needs care because each upload is large (2 MB), so the heavy file transfer goes straight to object storage.
- Scale reads by adding copies (cache nodes, replicas, CDN edges), which is much easier than scaling writes.

## 4. Why photos must not be stored in the database

- **Size:** 748 TB of photo files per year would make the database enormous, slow to back up, slow to restore and expensive to run.
- **Cost:** database storage is far more expensive per terabyte than object storage.
- **Performance:** large binary files would use up the database's memory and connections that queries need.
- **Delivery:** a database cannot serve files to users through a CDN, while object storage can.

**Where photos go instead:** in **object storage** (such as Amazon S3), which is built for huge numbers of large files and is cheap