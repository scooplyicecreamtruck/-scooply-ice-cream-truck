# Scooply Ice Cream Truck — V2

This is a deployable Node.js website prototype with:

- Responsive Scooply homepage
- Booking request form with no online payment
- Automatic server-side booking storage
- Automatic owner + customer email support through Gmail SMTP
- Real AI assistant endpoint using the OpenAI Responses API
- Password-protected booking dashboard
- Booking statuses: New Request, Reviewing, Confirmed, Completed, Cancelled

## Run locally

1. Install Node.js 20+.
2. Open this folder in Terminal.
3. Run:
   npm install
4. Copy `.env.example` to `.env`.
5. Fill in:
   - ADMIN_PASSWORD
   - GMAIL_APP_PASSWORD
   - OPENAI_API_KEY
6. Run:
   npm start
7. Open:
   http://localhost:3000
8. Dashboard:
   http://localhost:3000/dashboard

## Gmail setup

Use the Scooply Gmail account already created.

For automatic sending:
- Enable 2-Step Verification on the Google account.
- Create a Google App Password.
- Put the App Password in `GMAIL_APP_PASSWORD`.
- Do NOT put the normal Gmail password into the project.

## OpenAI setup

Create an OpenAI API key and set `OPENAI_API_KEY`.
The default model in `.env.example` is `gpt-5.6-luna` for a cost-conscious customer-service setup.

## Important deployment note

This project is ready to configure, but it is not automatically published to the public internet by this ZIP alone. Deploy it to a Node-compatible host and set the environment variables there.

## Current business rules

- No online payment.
- Booking requests are NOT automatically confirmed.
- AI must not invent pricing, inventory, availability, service area, permits, or policies.
- Customer contact email: scooplyicecreamtruck@gmail.com.
