# Reflection

## The most difficult concept

The most difficult concept for me was asynchronous code: understanding how `async` / `await` works with `fetch`, and how to handle errors properly. At first I did not understand why the code after a request did not wait, or why a failed request did not always throw an error. I overcame it by building the user list and the QuickNotes client step by step. I learned to check `response.ok`, to wrap each request in `try` / `catch` / `finally`, and to test the error path on purpose by breaking the URL. Seeing the error message appear and the button come back to life made the idea clear.

## What I would improve in my capstone

Based on the feedback I received, I would make my architecture diagram clearer and explain each step of the request flows in more detail. I would also add more about error handling in the API design, such as what the client should do after each error code, and I would show my numbers more carefully when I explain the load estimates. A clearer diagram would make it easier for the backend team to follow the design.

## What I will learn next

Next I want to build a real backend of my own with a framework such as Node.js and Express, connected to a SQL database, so that I can create the endpoints I designed instead of using a practice API. After that I want to learn authentication (login and tokens) and how to deploy an app online so that other people can use it.
