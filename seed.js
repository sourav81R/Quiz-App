const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/quizApp", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ MongoDB connected for seeding"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const questionSchema = new mongoose.Schema({
  quiz: String,
  question: String,
  options: [String],
  answer: String
});

const Question = mongoose.model("Question", questionSchema);

async function seedData() {
  try {
    await Question.deleteMany(); // clear old data

    await Question.insertMany([
      // 🌍 General Knowledge (10)
      {
        quiz: "General Knowledge",
        question: "Which planet is known as the 'Red Planet'?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        answer: "Mars"
      },
      {
        quiz: "General Knowledge",
        question: "What is the capital city of Japan?",
        options: ["Beijing", "Tokyo", "Seoul", "Bangkok"],
        answer: "Tokyo"
      },
      {
        quiz: "General Knowledge",
        question: "Who wrote the play 'Romeo and Juliet'?",
        options: ["William Shakespeare", "Jane Austen", "Charles Dickens", "Mark Twain"],
        answer: "William Shakespeare"
      },
      {
        quiz: "General Knowledge",
        question: "In which year did the Titanic sink?",
        options: ["1905", "1912", "1920", "1931"],
        answer: "1912"
      },
      {
        quiz: "General Knowledge",
        question: "What is the largest continent on Earth?",
        options: ["Africa", "Asia", "Europe", "North America"],
        answer: "Asia"
      },
      {
        quiz: "General Knowledge",
        question: "Which country is known as the Land of the Rising Sun?",
        options: ["China", "Japan", "Thailand", "South Korea"],
        answer: "Japan"
      },
      {
        quiz: "General Knowledge",
        question: "How many players are there in a cricket team?",
        options: ["9", "10", "11", "12"],
        answer: "11"
      },
      {
        quiz: "General Knowledge",
        question: "What is the national currency of the USA?",
        options: ["Dollar", "Euro", "Pound", "Yen"],
        answer: "Dollar"
      },
      {
        quiz: "General Knowledge",
        question: "Which is the tallest mountain in the world?",
        options: ["K2", "Mount Everest", "Kangchenjunga", "Lhotse"],
        answer: "Mount Everest"
      },
      {
        quiz: "General Knowledge",
        question: "What is the smallest country in the world?",
        options: ["Monaco", "Vatican City", "Malta", "San Marino"],
        answer: "Vatican City"
      },

      // ➕ Mathematics (10)
      {
        quiz: "Mathematics",
        question: "What is 12 × 8?",
        options: ["96", "108", "84", "88"],
        answer: "96"
      },
      {
        quiz: "Mathematics",
        question: "What is the square root of 144?",
        options: ["10", "11", "12", "13"],
        answer: "12"
      },
      {
        quiz: "Mathematics",
        question: "Solve: 15 ÷ 3 × 2",
        options: ["10", "12", "8", "6"],
        answer: "10"
      },
      {
        quiz: "Mathematics",
        question: "What is the value of π (pi) up to two decimal places?",
        options: ["3.12", "3.14", "3.16", "3.18"],
        answer: "3.14"
      },
      {
        quiz: "Mathematics",
        question: "What is 25% of 200?",
        options: ["25", "50", "75", "100"],
        answer: "50"
      },
      {
        quiz: "Mathematics",
        question: "What is the perimeter of a square with side 8 cm?",
        options: ["24 cm", "32 cm", "16 cm", "36 cm"],
        answer: "32 cm"
      },
      {
        quiz: "Mathematics",
        question: "What is the area of a circle with radius 7 cm? (Use π = 3.14)",
        options: ["154 cm²", "144 cm²", "164 cm²", "140 cm²"],
        answer: "154 cm²"
      },
      {
        quiz: "Mathematics",
        question: "Simplify: (8 + 2) × (6 - 4)",
        options: ["10", "20", "15", "25"],
        answer: "20"
      },
      {
        quiz: "Mathematics",
        question: "Convert 0.75 into a fraction.",
        options: ["1/2", "2/3", "3/4", "4/5"],
        answer: "3/4"
      },
      {
        quiz: "Mathematics",
        question: "What is 9²?",
        options: ["81", "72", "90", "99"],
        answer: "81"
      },

      // 🏛 Politics (10)
      {
        quiz: "Politics",
        question: "Which of the following is not a feature of the Parliamentary Form of Government in India?",
        options: [
          "Sovereignty of Parliament",
          "Periodic dissolution of Parliament",
          "Collective responsibility of the executive to the legislature",
          "Coalition party rule"
        ],
        answer: "Coalition party rule"
      },
      {
        quiz: "Politics",
        question: "Who is the current President of the Indian National Congress party?",
        options: ["Sonia Gandhi", "Rahul Gandhi", "Priyanka Gandhi Vadra", "Mallikarjun Kharge"],
        answer: "Mallikarjun Kharge"
      },
      {
        quiz: "Politics",
        question: "Who was the first Prime Minister of India?",
        options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Sardar Patel", "Rajendra Prasad"],
        answer: "Jawaharlal Nehru"
      },
      {
        quiz: "Politics",
        question: "What is the minimum age required to become the President of India?",
        options: ["25", "30", "35", "40"],
        answer: "35"
      },
      {
        quiz: "Politics",
        question: "Which article of the Indian Constitution provides the right to equality?",
        options: ["Article 14", "Article 15", "Article 19", "Article 21"],
        answer: "Article 14"
      },
      {
        quiz: "Politics",
        question: "Who is known as the Father of the Indian Constitution?",
        options: ["Mahatma Gandhi", "B. R. Ambedkar", "Jawaharlal Nehru", "Sardar Patel"],
        answer: "B. R. Ambedkar"
      },
      {
        quiz: "Politics",
        question: "The United Nations was established in which year?",
        options: ["1942", "1945", "1950", "1955"],
        answer: "1945"
      },
      {
        quiz: "Politics",
        question: "Which is the upper house of the Indian Parliament?",
        options: ["Lok Sabha", "Rajya Sabha", "Vidhan Sabha", "Gram Sabha"],
        answer: "Rajya Sabha"
      },
      {
        quiz: "Politics",
        question: "How many permanent members are there in the UN Security Council?",
        options: ["3", "4", "5", "6"],
        answer: "5"
      },
      {
        quiz: "Politics",
        question: "What is the minimum age required to become a Member of Parliament in the Lok Sabha?",
        options: ["18", "21", "25", "30"],
        answer: "25"
      },

      // 🌿 Nature (10)
      {
        quiz: "Nature",
        question: "What is the largest mammal in the world?",
        options: ["African Elephant", "Blue Whale", "Polar Bear", "Giraffe"],
        answer: "Blue Whale"
      },
      {
        quiz: "Nature",
        question: "Which gas do plants absorb during photosynthesis?",
        options: ["Carbon Dioxide", "Nitrogen", "Hydrogen", "Oxygen"],
        answer: "Carbon Dioxide"
      },
      {
        quiz: "Nature",
        question: "Which mountain range is the longest in the world?",
        options: ["Andes", "Himalayas", "Rocky Mountains", "Alps"],
        answer: "Andes"
      },
      {
        quiz: "Nature",
        question: "Which endangered species is known for its black and white fur and is native to China?",
        options: ["Giant Panda", "Snow Leopard", "Bengal Tiger", "African Elephant"],
        answer: "Giant Panda"
      },
      {
        quiz: "Nature",
        question: "Which layer of the Earth contains the tectonic plates?",
        options: ["Crust", "Mantle", "Outer Core", "Inner Core"],
        answer: "Crust"
      },
      {
        quiz: "Nature",
        question: "Which is the fastest land animal?",
        options: ["Cheetah", "Leopard", "Horse", "Lion"],
        answer: "Cheetah"
      },
      {
        quiz: "Nature",
        question: "What is the tallest tree species in the world?",
        options: ["Baobab", "Sequoia", "Pine", "Bamboo"],
        answer: "Sequoia"
      },
      {
        quiz: "Nature",
        question: "Which ocean is the largest on Earth?",
        options: ["Atlantic", "Indian", "Pacific", "Arctic"],
        answer: "Pacific"
      },
      {
        quiz: "Nature",
        question: "What type of blood do mosquitoes prefer?",
        options: ["O+", "A+", "B+", "All types"],
        answer: "O+"
      },
      {
        quiz: "Nature",
        question: "Which bird is known for mimicking human speech?",
        options: ["Crow", "Parrot", "Pigeon", "Sparrow"],
        answer: "Parrot"
      }
    ]);

    console.log("✅ All quiz questions inserted successfully!");
    process.exit();
  } catch (err) {
    console.error("❌ Error inserting data:", err);
    process.exit(1);
  }
}

seedData();
