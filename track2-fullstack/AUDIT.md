# Code Review Audit

After reviewing the initial FarmTracker codebase, I have identified several bugs, design flaws, and architectural issues. Here is a summary of my findings and how I intend to prioritize them:

### Issues Identified

1. **Incorrect Paddock Count on Update (Bug)**
   In `backend/routes/animals.js` (`PUT /:id`), when an animal is moved to a new paddock, the new paddock's `animal_count` is incremented, but the old paddock's count is never decremented. This will lead to data corruption over time as paddocks appear artificially full.
2. **Missing Capacity Validation (Bug)**
   When creating (`POST`) or updating (`PUT`) an animal's `paddock_id`, there is no check against the destination paddock's `capacity`. Users can overfill paddocks beyond their defined limits.
3. **N+1 Query Problem (Architecture/Performance)**
   In `backend/routes/animals.js` (`GET /`), fetching the paginated list of animals performs a `SELECT * FROM animals` followed by a separate `SELECT` query for the latest health event of *each* animal in a loop. This is a classic N+1 query issue that will severely degrade performance as the number of records grows.
4. **Missing Data Validation (Design)**
   API inputs are largely trusted without validation. For example, moving an animal to a non-existent `paddock_id` will succeed in updating the animal record but could cause issues in the frontend or database consistency.
5. **Lack of Cascade Rules for Paddocks (Design)**
   While `health_events` correctly cascade on animal deletion, `animals` do not have strict foreign key constraints handling the potential deletion of a `paddock`.

### Prioritization

**What I will fix first, and why:**
1. **The Paddock Count Bug**: This is the most critical issue because it directly corrupts the database state during normal operations. 
2. **Capacity Validation**: A core business rule (paddock capacity) is currently being ignored. Fixing this prevents invalid states from being created.
3. **The N+1 Query (Architectural Improvement)**: I will fix this by using a SQL `LEFT JOIN` to fetch the latest health event in a single query, significantly improving API performance.

**What I will leave for later:**
- Comprehensive input sanitization and schema validation (e.g., using a library like Joi or Zod).
- Implementing Paddock deletion (which would require handling `ON DELETE` rules for the animals inside).
- Migrating from OFFSET-based pagination to cursor-based pagination, which is better for large datasets but not strictly necessary for this prototype.
