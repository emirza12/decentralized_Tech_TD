# E-commerce API with Database Replication

This project demonstrates three different approaches to implementing an e-commerce API with various levels of database replication.

## Project Structure

```
├── Basic_Implementation/        # Basic version without replication
│   ├── db/
│   │   ├── config.js           # Database configuration
│   │   └── init.sql            # Initialization script
│   ├── public/                 # Static files
│   ├── server.js               # Express server
│   └── .env.example           # Environment variables template
│
├── Synchronous_Mirroring/      # Version with synchronous replication
│   ├── db/
│   │   ├── config.js          # Dual database configuration
│   │   └── init.sql
│   ├── middleware/
│   │   └── timeout.js         # Timeout handling
│   ├── public/
│   └── server.js
│
└── Asynchronous-Replication/   # Version with asynchronous replication
    ├── db/
    │   └── config.js          # Queue-based configuration
    ├── middleware/
    │   └── replication-monitor.js
    ├── public/
    └── server.js
```

## Implementation Comparison

### 1. Basic Implementation
- Single database
- Simple setup
- No fault tolerance
- Port: 3001

### 2. Synchronous Mirroring
- Two synchronized databases
- Strong data consistency
- Automatic failover
- Slightly slower performance
- Port: 3001

### 3. Asynchronous Replication
- Background replication
- Better performance
- Monitoring interface
- Possible replication delay
- Port: 3001

## Setup

1. **Clone the project**
```bash
git clone [repo-url]
cd [repo-name]
```

2. **Configure databases**
```sql
# For Basic Implementation
psql -U postgres
CREATE DATABASE ecommerce;
\q
psql -U postgres -d ecommerce -f Basic_Implementation/db/init.sql

# For Synchronous/Async
psql -U postgres
CREATE DATABASE ecommerce_primary;
CREATE DATABASE ecommerce_mirror;
\q
psql -U postgres -d ecommerce_primary -f db/init.sql
psql -U postgres -d ecommerce_mirror -f db/init.sql
```

3. **Set up environment variables**
Copy .env.example files to .env in each folder and adjust values.

4. **Install dependencies and start**
```bash
# Choose an implementation
cd [implementation-folder]
npm install
npm start
```

## Testing Different Versions

### Basic Implementation
```bash
cd Basic_Implementation
npm start
# Test at http://localhost:3001
```

### Synchronous Mirroring
```bash
cd Synchronous_Mirroring
npm start
# Test at http://localhost:3001
# Simulate failure: sudo service postgresql stop
```

### Asynchronous Replication
```bash
cd Asynchronous-Replication
npm start
# Test at http://localhost:3001
# Monitor replication status in the interface
```

## Features

- ✅ Product CRUD
- ✅ Shopping Cart Management
- ✅ Order Processing
- ✅ User Interface
- ✅ Fault Tolerance (Sync/Async)
- ✅ System Monitoring (Async)

## API Endpoints

- `GET /products` - List products
- `POST /products` - Add product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product
- `GET /cart/:userId` - View cart
- `POST /cart/:userId` - Add to cart
- `POST /orders` - Create order

## Security

- Environment variables for credentials
- Input validation
- Timeout handling
- Error logging

## Known Limitations

- No user authentication
- No automated tests
- No complete API documentation
- No session management

## License
MIT