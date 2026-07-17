# 🛡️ beHonest

**beHonest** is a smart Lost & Found platform designed for colleges that helps reunite owners with their lost belongings through AI-powered verification instead of relying solely on manual identification.

Unlike traditional Lost & Found systems, beHonest ensures that only the genuine owner can claim an item by intelligently comparing the claimant's answers with the details provided by the person who found the item.

---

## 🚀 Features

### 👤 User Authentication
- Secure user registration and login
- JWT-based authentication
- Protected routes for authenticated users

### 📦 Lost & Found Management
- Report found items with images
- Store item details including category, brand, color, location, date, and description
- View all available found items
- Search and filter items

### 🤖 AI-Powered Ownership Verification
- Dynamic verification questions generated from item details
- Intelligent keyword matching
- Location similarity scoring
- Date similarity scoring
- Weighted confidence score calculation
- Automatic ownership verdict generation:
  - Genuine Owner
  - Needs Manual Review
  - Likely Incorrect Claim

### 📄 Claim Management
- Submit ownership claims
- AI verification for every claim
- Store claim history
- View verification score and verdict

### 📸 Image Upload
- Upload item images securely
- Preview uploaded images

### 📱 Responsive UI
- Clean and modern interface
- Mobile-friendly design
- Easy navigation

---

# 🧠 How AI Verification Works

Instead of asking users to simply identify their item, beHonest evaluates multiple aspects of the claim.

The verification engine compares:

- Brand
- Color
- Unique Identifying Marks
- Lost Location
- Lost Date

Each answer contributes to a weighted confidence score.

Example:

| Verification | Weight |
|--------------|--------|
| Brand Match | 30% |
| Color Match | 20% |
| Unique Marks | 30% |
| Location Match | 10% |
| Date Match | 10% |

Based on the total confidence score:

- ✅ **80% and above** → Genuine Owner
- ⚠️ **50% – 79%** → Needs Manual Review
- ❌ **Below 50%** → Likely Incorrect Claim

This approach significantly reduces false ownership claims while maintaining fairness.

---

# 🛠️ Tech Stack

## Frontend

- React.js
- Vite
- Tailwind CSS
- React Router
- Axios

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Multer (Image Upload)

---

# 📂 Project Structure

```
beHonest/
│
├── client/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── uploads/
│   ├── utils/
│   └── server.js
│
├── README.md
└── package.json
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/beHonest.git
```

```bash
cd beHonest
```

---

## Install Dependencies

### Backend

```bash
cd server
npm install
```

### Frontend

```bash
cd client
npm install
```

---

## Environment Variables

Create a `.env` file inside the **server** folder.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection

JWT_SECRET=your_secret_key

CLIENT_URL=http://localhost:5173
```

---

## Run Backend

```bash
cd server
npm run dev
```

---

## Run Frontend

```bash
cd client
npm run dev
```

---

# 📸 Screenshots

Add screenshots here.

Example:

```
Home Page

Login

Dashboard

Found Item Form

Claim Verification

AI Verdict Screen
```

---

# 🔄 Workflow

1. User logs in.
2. Finder reports a found item.
3. Item gets listed on the platform.
4. Owner submits a claim.
5. AI asks verification questions.
6. Answers are compared with stored item details.
7. Confidence score is calculated.
8. Verdict is generated.
9. Claim is stored for future reference.

---

# 🌟 Future Enhancements

- OCR for serial numbers and labels
- QR code integration
- Email notifications
- Push notifications
- AI image similarity matching
- Admin dashboard
- College-wise deployment
- Chat between finder and owner
- Multi-language support
- Mobile application

---

# 📜 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Sandesh Pawar**

---

⭐ If you found this project helpful, consider giving it a star!
