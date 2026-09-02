import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "data", "bookings.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function readBookings() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeBookings(items) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

function clean(v, max = 500) {
  return String(v ?? "").trim().slice(0, max);
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function adminAuthorized(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const supplied = req.get("x-admin-password") || "";

  if (!expected) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/api/bookings", async (req, res) => {
  const body = req.body || {};

  const booking = {
    id: `SC-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "New Request",
    name: clean(body.name, 120),
    email: clean(body.email, 180),
    date: clean(body.date, 20),
    time: clean(body.time, 20),
    eventType: clean(body.eventType, 120),
    guests: clean(body.guests, 20),
    address: clean(body.address, 300),
    notes: clean(body.notes, 1000),
    aiSummary: clean(body.aiSummary, 1200)
  };

  if (
    !booking.name ||
    !validEmail(booking.email) ||
    !booking.date ||
    !booking.time ||
    !booking.eventType ||
    !booking.address
  ) {
    return res.status(400).json({
      ok: false,
      error: "Please complete all required fields."
    });
  }

  const bookings = await readBookings();
  bookings.unshift(booking);
  await writeBookings(bookings);

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (scriptUrl) {
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestId: booking.id,
          name: booking.name,
          email: booking.email,
          date: booking.date,
          time: booking.time,
          eventType: booking.eventType,
          guests: booking.guests,
          location: booking.address,
          notes: booking.notes,
          aiSummary: booking.aiSummary
        })
      });

      const result = await response.text();

      console.log(
        "Google Script response:",
        response.status,
        result
      );
    } catch (err) {
      console.error(
        "Google Script error:",
        err.message
      );
    }
  } else {
    console.error(
      "Google Script error: GOOGLE_SCRIPT_URL is not configured"
    );
  }

  res.json({
    ok: true,
    bookingId: booking.id
  });
});

app.post("/api/ai", async (req, res) => {
  const message = clean(req.body?.message, 2000);
  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-10)
    : [];

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "Message is required."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      ok: true,
      fallback: true,
      answer:
        "I can help with Scooply booking requests. For a booking, I need the event date, time, location, event type, estimated guest count, your name, and email. No online payment is collected, and every request must be confirmed by the Scooply team."
    });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const model =
      process.env.OPENAI_MODEL || "gpt-5.6-luna";

    const transcript = history
      .map(
        x =>
          `${
            x.role === "user"
              ? "Customer"
              : "Assistant"
          }: ${clean(x.content, 1000)}`
      )
      .join("\n");

    const input = `You are Scooply AI Assistant for Scooply Ice Cream Truck.

Business rules:
- Help customers professionally and warmly.
- The website collects BOOKING REQUESTS only. Never say a booking is confirmed unless a human confirmed it.
- There is NO online payment on the website.
- Never invent prices, availability, service areas, inventory, permits, or policies.
- If information is unknown, say the Scooply team will confirm by email.
- Contact email: scooplyicecreamtruck@gmail.com.
- For a booking request, collect: customer name, email, event date, start time, full location, event type, estimated guest count, and optional notes.
- Ask one or two useful questions at a time.
- Keep replies concise and natural.
- If the customer gives enough information, summarize the request and tell them they can submit it through the booking form.

Conversation so far:
${transcript}

Customer: ${message}`;

    const response =
      await client.responses.create({
        model,
        input
      });

    res.json({
      ok: true,
      answer:
        response.output_text ||
        "Please email the Scooply team for help."
    });
  } catch (err) {
    console.error(
      "OpenAI error:",
      err.message
    );

    res.status(500).json({
      ok: false,
      error: "AI is temporarily unavailable."
    });
  }
});

app.get("/api/admin/bookings", async (req, res) => {
  if (!adminAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const bookings = await readBookings();

  res.json({
    ok: true,
    bookings
  });
});

app.patch(
  "/api/admin/bookings/:id",
  async (req, res) => {
    if (!adminAuthorized(req)) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const allowed = [
      "New Request",
      "Reviewing",
      "Confirmed",
      "Completed",
      "Cancelled"
    ];

    const status = clean(
      req.body?.status,
      50
    );

    if (!allowed.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid status."
      });
    }

    const bookings = await readBookings();

    const item = bookings.find(
      b => b.id === req.params.id
    );

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: "Booking not found."
      });
    }

    item.status = status;
    item.updatedAt =
      new Date().toISOString();

    await writeBookings(bookings);

    res.json({
      ok: true,
      booking: item
    });
  }
);

app.get("/dashboard", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "dashboard.html"
    )
  );
});

app.listen(PORT, () => {
  console.log(
    `Scooply V2 running at http://localhost:${PORT}`
  );
});
