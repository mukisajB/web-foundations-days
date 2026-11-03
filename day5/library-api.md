# Library Books API

## Endpoints

- **GET /books**
  - List all books
  - Success: 200 OK

- **GET /books/{id}**
  - Get details of one book
  - Success: 200 OK

- **POST /books**
  - Create a new book
  - Request body:
    ```json
    {
      "title": "Example Book",
      "author": "Jane Doe",
      "year": 2026
    }
    ```
  - Success: 201 Created

- **PUT /books/{id}**
  - Update an existing book
  - Request body:
    ```json
    {
      "title": "Updated Title"
    }
    ```
  - Success: 200 OK

- **DELETE /books/{id}**
  - Delete a book
  - Success: 204 No Content

- **GET /books?author=Jane%20Doe**
  - List books by a specific author
  - Success: 200 OK

## Error Codes
- **400 Bad Request**  
  Example: Missing required field "title" when creating a book.
- **404 Not Found**  
  Example: Requesting `/books/999` when no book with that ID exists.
