# Retrospective

### What trade-offs did you make?
In fixing the N+1 query issue, I chose to use a SQL `LEFT JOIN` with a subquery specifically selecting the single latest health event per animal. While this effectively solves the N+1 problem, it can still be relatively heavy for very large tables since SQLite executes the subquery repeatedly without specific indexing on `(animal_id, date DESC)`. I accepted this trade-off because it’s much faster than N separate queries and keeps the codebase simple without adding complex views or caching layers.

### What would you do differently with more time?
With more time, I would rewrite the data access layer. Currently, the raw SQL queries are scattered directly inside the Express route handlers. I would separate these into dedicated service or repository modules to decouple the API endpoints from the database logic. Furthermore, I would implement robust schema validation (using a library like Zod or Joi) for all API payloads, as the current validation is quite manual and fragile.

### What was left alone and why?
I deliberately left the `delete` operations without full cascading safeguards (like paddocks deletion cascading or throwing errors) and pagination remaining as `OFFSET`/`LIMIT`. Modifying the pagination strategy to a cursor-based approach would have required non-trivial changes to both the frontend and backend, which felt out of scope for the current sprint since the existing dataset size doesn't warrant it yet. I also left the frontend mostly in its vanilla HTML/JS state instead of migrating to a modern UI framework to maintain the project's original simplicity and focus entirely on core bug fixes and the requested feature addition.
