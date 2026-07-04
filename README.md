# Sharna - Sustainable Fashion & Lasting Luxury Backend

Production-ready REST API powering the Sharna fashion e-commerce storefront.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Payments:** Razorpay
- **WhatsApp API:** Meta WhatsApp Cloud API

## Key Features
1. **User Authentication:** Sign Up, Login, profile updates, address management with JWT authorization.
2. **Product Catalog:** Paginated listing, sorting (price, date), text search, category filters.
3. **Cart & Wishlist:** Authenticated server-side persistence.
4. **Orders & Checkout:** Order generation, status updates, tracking numbers.
5. **Razorpay Payments:** Hmac-SHA256 signature verification matching Razorpay order configurations.
6. **Meta WhatsApp Notifications:** Template updates on order placing.
7. **Admin controls:** Total dashboard metrics aggregation, user blocking, order dispatch updates.
8. **Contact support:** Customer form handler.
9. **Dynamic Policies:** Editable Cancellations, Privacy, Terms, and Shipping configurations.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Settings
Copy `.env.example` to `.env` and fill in your connection details:
```bash
cp .env.example .env
```

### 3. Run Dev Mode Server
```bash
npm run dev
```
The server will boot on [http://localhost:5000](http://localhost:5000).
Check connectivity: `GET /api/health`.
