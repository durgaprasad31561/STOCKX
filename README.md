# 📈 STOCKX

A full-stack stock market prediction and sentiment analysis platform built using React, Node.js, and data-driven ML models.

---

## 🚀 Features

- 🔐 User Authentication (Register/Login)
- 📊 Stock Price Prediction from CSV datasets
- 📰 News Sentiment Analysis
- 📈 Archive Dataset Predictions
- 📉 Correlation & Statistical Insights
- 🧠 ML-based Prediction Scripts
- 📂 Admin Dashboard (Users, Searches, Logs)
- 📦 Clean REST API Architecture

---

## 🛠️ Tech Stack

### Frontend
- React (Vite)
- Modern UI Components
- Chart Visualization

### Backend
- Node.js
- Express.js
- REST API Architecture

### Database
- MongoDB (User + Run storage)

### ML / Data
- CSV-based prediction engine
- Statistical utilities
- Sentiment analysis service

---

## Project Structure

PALAVAR/
└── stocks/
├── src/ # React frontend
├── server/ # Backend API
│ ├── routes/
│ ├── services/
│ ├── models/
│ └── data/
├── public/
├── package.json
└── README.md


---

## ⚙️ Installation & Setup

### Clone the Repository

```bash
git clone https://github.com/durgaprasad31561/STOCKX.git
cd STOCKX/stocks

Install Dependencies:
Frontend:
    npm install
Backend:
    cd server
    npm install

Setup Environment Variables:
   Create a .env file inside server/:
                  PORT=5000
                  MONGO_URI=your_mongodb_connection_string
                  JWT_SECRET=your_secret_key
                  EMAIL_USER=your_email
                  EMAIL_PASS=your_app_password

Run the Application:
   npm run dev


