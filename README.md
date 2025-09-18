# 📚 Quiz App  

A full-stack **Quiz Application** built with **React (frontend)**, **Express & Node.js (backend)**, and **MongoDB (database)**.  
This app allows users to take quizzes, fetch questions dynamically from the database, and view results at the end.  

---

## 🌍 Live Demo  

👉 [Quiz App Live](https://quiz-app-ebon-five-26.vercel.app/)  

---

## 🚀 Features  

- 🎯 Take interactive quizzes with multiple-choice questions  
- 🗄️ Questions fetched from **MongoDB**  
- 📊 Result evaluation & score display  
- 🎨 Responsive UI with **HTML, CSS, JS, and React**  
- ⚡ RESTful API powered by **Express & Node.js**  
- 🌱 Database seeding script for adding initial quiz data  

---

## 🛠️ Tech Stack  

**Frontend:**  
- React.js  
- HTML, CSS, JavaScript  

**Backend:**  
- Node.js  
- Express.js  

**Database:**  
- MongoDB (Mongoose ODM)  

---

## 📂 Project Structure  

Quiz-App/  
│── models/            # MongoDB models (Question, Quiz, Result)  
│   ├── Question.js  
│   ├── Quiz.js  
│   └── Result.js  
│  
│── public/            # Frontend files  
│   ├── app.js         # React app entry  
│   ├── index.html     # Main HTML file  
│   └── styles.css     # Stylesheet  
│  
│── node_modules/      # Dependencies  
│── .env.example       # Environment variables example  
│── package.json       # Project dependencies & scripts  
│── package-lock.json  # Lock file  
│── seed.js            # Script to seed database with sample data  
│── server.js          # Express server entry point  

---

## ⚙️ Installation & Setup  

### 1️⃣ Clone the Repository  
git clone https://github.com/sourav81R/quiz-app.git  
cd quiz-app  

### 2️⃣ Install Dependencies  
npm install  

### 3️⃣ Setup Environment Variables  
Create a `.env` file in the root directory based on `.env.example`:  

MONGO_URI=mongodb://127.0.0.1:27017/quizApp  
PORT=5000  

### 4️⃣ Seed Database with Sample Questions  
node seed.js  

### 5️⃣ Run Backend Server  
node server.js  

Server will start on: http://localhost:5000  

### 6️⃣ Run Frontend (React)  
If using CRA or Vite setup inside `public/`, start with:  

npm start  

---


## 📌 Future Enhancements  

- 🔐 User authentication (login/signup)  
- 🏆 Leaderboard for top scores  
- ⏳ Timer for quizzes  
- 📱 Progressive Web App (PWA) support  

---

## 🤝 Contributing  

Contributions are welcome! Feel free to fork this repo and submit a pull request.  

---

## ✍️ Author  

**Sourav**  

---

## 📄 License  

This project is licensed under the **MIT License**.  
