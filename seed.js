// ===== seed.js =====

require("dotenv").config();

const mongoose = require("mongoose");
const { normalizeMongoUri, maskMongoUri, formatMongoError } = require("./mongoUri");

const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const mongoUri = normalizeMongoUri(rawMongoUri);

if (!mongoUri) {
  console.error("Missing MONGODB_URI or MONGO_URI in .env");
  process.exit(1);
}

console.log(`Seeding with MongoDB: ${maskMongoUri(mongoUri)}`);
mongoose
  .connect(mongoUri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  })
  .then(() => console.log("MongoDB connected for seeding"))
  .catch((err) => console.error("MongoDB connection error:", formatMongoError(err)));

const questionSchema = new mongoose.Schema({
  quiz: String,
  question: String,
  options: [String],
  answer: String,
  image: String,
  level: { type: Number, default: 1 }
});

const Question = mongoose.model("Question", questionSchema);

async function seedData() {
  try {
    await Question.deleteMany();

    await Question.insertMany([
      // 🌍 General Knowledge (10)
      {
        quiz: "General Knowledge",
        question: "Which planet is known as the 'Red Planet'?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        answer: "Mars",
        image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "What is the capital city of Japan?",
        options: ["Beijing", "Tokyo", "Seoul", "Bangkok"],
        answer: "Tokyo",
        image: "https://images.unsplash.com/photo-1562789746857-92a973e60196?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "Who wrote the play 'Romeo and Juliet'?",
        options: ["William Shakespeare", "Jane Austen", "Charles Dickens", "Mark Twain"],
        answer: "William Shakespeare",
        image: "https://images.unsplash.com/photo-1586201375761-83865001f3a0?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "In which year did the Titanic sink?",
        options: ["1905", "1912", "1920", "1931"],
        answer: "1912",
        image: "https://upload.wikimedia.org/wikipedia/commons/f/fd/RMS_Titanic_3.jpg",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "What is the largest continent on Earth?",
        options: ["Africa", "Asia", "Europe", "North America"],
        answer: "Asia",
        image: "https://images.unsplash.com/photo-1535442268860-9a5cb42d6c7f?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "Which country is known as the Land of the Rising Sun?",
        options: ["China", "Japan", "Thailand", "South Korea"],
        answer: "Japan",
        image: "https://images.unsplash.com/photo-1507825249594-5fd84932c2ed?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "How many players are there in a cricket team?",
        options: ["9", "10", "11", "12"],
        answer: "11",
        image: "https://images.unsplash.com/photo-1623227774665-3b74b5031e68?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "What is the national currency of the USA?",
        options: ["Dollar", "Euro", "Pound", "Yen"],
        answer: "Dollar",
        image: "https://images.unsplash.com/photo-1552223015-76c25b17ca5a?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "Which is the tallest mountain in the world?",
        options: ["K2", "Mount Everest", "Kangchenjunga", "Lhotse"],
        answer: "Mount Everest",
        image: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "General Knowledge",
        question: "What is the smallest country in the world?",
        options: ["Monaco", "Vatican City", "Malta", "San Marino"],
        answer: "Vatican City",
        image: "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      
      // ➕ Mathematics (10)
      {
        quiz: "Mathematics",
        question: "What is 12 × 8?",
        options: ["96", "108", "84", "88"],
        answer: "96",
        image: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is the square root of 144?",
        options: ["10", "11", "12", "13"],
        answer: "12",
        image: "https://images.unsplash.com/photo-1581091870620-6f0c2073d458?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "Solve: 15 ÷ 3 × 2",
        options: ["10", "12", "8", "6"],
        answer: "10",
        image: "https://images.unsplash.com/photo-1581093448796-7a2eae3db9b0?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is the value of π (pi) approximately?",
        options: ["3.12", "3.14", "3.16", "3.18"],
        answer: "3.14",
        image: "https://images.unsplash.com/photo-1541034165520-55ce25e1b31c?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is 50% of 100?",
        options: ["25", "50", "75", "100"],
        answer: "50",
        image: "https://images.unsplash.com/photo-1600607685394-06edcfbaff82?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is the perimeter of a square with side 8 cm?",
        options: ["24 cm", "32 cm", "16 cm", "36 cm"],
        answer: "32 cm",
        image: "https://images.unsplash.com/photo-1564865878259-75811fa13e97?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is the area of a circle with radius 7 cm? (Use π = 3.14)",
        options: ["154 cm²", "144 cm²", "164 cm²", "140 cm²"],
        answer: "154 cm²",
        image: "https://images.unsplash.com/photo-1607113913770-474d7a608ed3?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "Simplify: (8 + 2) × (6 - 4)",
        options: ["10", "20", "15", "25"],
        answer: "20",
        image: "https://images.unsplash.com/photo-1590157839415-f97384ec3e36?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "Convert 0.75 into a fraction.",
        options: ["1/2", "2/3", "3/4", "4/5"],
        answer: "3/4",
        image: "https://images.unsplash.com/photo-1600314782859-95eca06e4ae7?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Mathematics",
        question: "What is 9²?",
        options: ["81", "72", "90", "99"],
        answer: "81",
        image: "https://images.unsplash.com/photo-1573497491208-6b1acb260507?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },

      // 🏛 Politics (10)
      {
        quiz: "Politics",
        question: "Which of the following is not a feature of the Parliamentary Form of Government in India?",
        options: ["Sovereignty of Parliament", "Periodic dissolution of Parliament", "Collective responsibility of the executive to the legislature", "Coalition party rule"],
        answer: "Coalition party rule",
        image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "Who is the current President of the Indian National Congress party?",
        options: ["Sonia Gandhi", "Rahul Gandhi", "Priyanka Gandhi Vadra", "Mallikarjun Kharge"],
        answer: "Mallikarjun Kharge",
        image: "https://images.unsplash.com/photo-1599577180176-8a6fc32de7e9?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "Who was the first Prime Minister of India?",
        options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Sardar Patel", "Rajendra Prasad"],
        answer: "Jawaharlal Nehru",
        image: "https://images.unsplash.com/photo-1615301531213-b6f4b797c82d?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "What is the minimum age to become the President of India?",
        options: ["25", "30", "35", "40"],
        answer: "35",
        image: "https://images.unsplash.com/photo-1588056621858-3e1b3494d853?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "Which article of the Indian Constitution provides the right to equality?",
        options: ["Article 14", "Article 15", "Article 19", "Article 21"], 
        answer: "Article 14",
        image: "https://images.unsplash.com/photo-1606204027490-5c04ec1d1567?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "Who is known as the Father of the Indian Constitution?",
        options: ["Mahatma Gandhi", "B. R. Ambedkar", "Jawaharlal Nehru", "Sardar Patel"],
        answer: "B. R. Ambedkar",
        image: "https://images.unsplash.com/photo-1646027694907-1f8dd21786eb?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "The United Nations was established in which year?",
        options: ["1942", "1945", "1950", "1955"],
        answer: "1945",
        image: "https://images.unsplash.com/photo-1531966664273-4ca00dc1d264?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "Which is the upper house of the Indian Parliament?",
        options: ["Lok Sabha", "Rajya Sabha", "Vidhan Sabha", "Gram Sabha"],
        answer: "Rajya Sabha",
        image: "https://images.unsplash.com/photo-1576179436277-c6ceba950b17?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "How many permanent members are there in the UN Security Council?",
        options: ["3", "4", "5", "6"],
        answer: "5",
        image: "https://images.unsplash.com/photo-1512382039111-ec3f464ba6a0?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Politics",
        question: "What is the minimum age required to become a Member of Parliament in the Lok Sabha?",
        options: ["18", "21", "25", "30"],
        answer: "25",
        image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },

      {
        quiz: "Nature",
        question: "What is the largest mammal in the world?",
        options: ["African Elephant", "Blue Whale", "Polar Bear", "Giraffe"],
        answer: "Blue Whale",
        image: "https://images.unsplash.com/photo-1494378579339-4a84de9af634?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which gas do plants absorb during photosynthesis?",
        options: ["Carbon Dioxide", "Nitrogen", "Hydrogen", "Oxygen"],
        answer: "Carbon Dioxide",
        image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which mountain range is the longest in the world?",
        options: ["Andes", "Himalayas", "Rocky Mountains", "Alps"],
        answer: "Andes",
        image: "https://images.unsplash.com/photo-1534339837452-3491a630d6ab?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which animal is known as the 'Bamboo Eater'?",
        options: ["Giant Panda", "Snow Leopard", "Bengal Tiger", "African Elephant"],
        answer: "Giant Panda",
        image: "https://images.unsplash.com/photo-1523958203904-6c4b3c7d544c?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which layer of the Earth contains the tectonic plates?",
        options: ["Crust", "Mantle", "Outer Core", "Inner Core"],
        answer: "Crust",
        image: "https://images.unsplash.com/photo-1519817650390-64a93db51124?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which is the fastest land animal?",
        options: ["Cheetah", "Leopard", "Horse", "Lion"],
        answer: "Cheetah",
        image: "https://images.unsplash.com/photo-1535008652995-e95986556b4a?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "What is the tallest tree species in the world?",
        options: ["Baobab", "Sequoia", "Pine", "Bamboo"],
        answer: "Sequoia",
        image: "https://images.unsplash.com/photo-1518792525637-93a1f07579a3?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which ocean is the largest on Earth?",
        options: ["Atlantic", "Indian", "Pacific", "Arctic"],
        answer: "Pacific",
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "What type of blood do mosquitoes prefer?",
        options: ["O+", "A+", "B+", "All types"],
        answer: "O+",
        image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },
      {
        quiz: "Nature",
        question: "Which bird is known for mimicking human speech?",
        options: ["Crow", "Parrot", "Pigeon", "Sparrow"],
        answer: "Parrot",
        image: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1600&q=80",
        level: 1
      },

      {
        quiz: "General Knowledge",
        question: "What is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        answer: "Canberra",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "Which element has the chemical symbol 'Au'?",
        options: ["Silver", "Gold", "Copper", "Iron"],
        answer: "Gold",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "Which country has the most natural lakes?",
        options: ["USA", "Canada", "Russia", "Brazil"],
        answer: "Canada",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "What is the currency of Japan?",
        options: ["Yuan", "Yen", "Won", "Ringgit"],
        answer: "Yen",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "Who painted the Mona Lisa?",
        options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"],
        answer: "Leonardo da Vinci",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "What is the smallest planet in our solar system?",
        options: ["Mars", "Mercury", "Venus", "Pluto"],
        answer: "Mercury",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "Which ocean is the deepest?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        answer: "Pacific",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "What is the longest river in the world?",
        options: ["Amazon", "Nile", "Yangtze", "Mississippi"],
        answer: "Nile",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "Who discovered penicillin?",
        options: ["Marie Curie", "Alexander Fleming", "Isaac Newton", "Albert Einstein"],
        answer: "Alexander Fleming",
        level: 2
      },
      {
        quiz: "General Knowledge",
        question: "What is the capital of Canada?",
        options: ["Toronto", "Vancouver", "Ottawa", "Montreal"],
        answer: "Ottawa",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is the square root of 225?",
        options: ["13", "14", "15", "16"],
        answer: "15",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "Solve for x: 3x - 7 = 20",
        options: ["7", "8", "9", "10"],
        answer: "9",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is 7 cubed (7^3)?",
        options: ["49", "243", "343", "512"],
        answer: "343",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is the value of 5 factorial (5!)?",
        options: ["60", "100", "120", "150"],
        answer: "120",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is the area of a triangle with base 10 and height 5?",
        options: ["25", "50", "15", "100"],
        answer: "25",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is 15% of 200?",
        options: ["20", "25", "30", "35"],
        answer: "30",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "How many degrees are in a right angle?",
        options: ["45", "90", "180", "360"],
        answer: "90",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "Solve: 2 + 2 * 2",
        options: ["8", "6", "4", "10"],
        answer: "6",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "What is the next prime number after 7?",
        options: ["8", "9", "10", "11"],
        answer: "11",
        level: 2
      },
      {
        quiz: "Mathematics",
        question: "How many seconds are in an hour?",
        options: ["60", "360", "3600", "600"],
        answer: "3600",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Who is the current Secretary-General of the United Nations?",
        options: ["Ban Ki-moon", "Kofi Annan", "António Guterres", "Donald Trump"],
        answer: "António Guterres",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Which country has the longest written constitution in the world?",
        options: ["USA", "India", "UK", "France"],
        answer: "India",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Who is the current President of France?",
        options: ["Nicolas Sarkozy", "François Hollande", "Emmanuel Macron", "Marine Le Pen"],
        answer: "Emmanuel Macron",
        level: 2
      },
      {
        quiz: "Politics",
        question: "What is the lower house of the US Congress?",
        options: ["Senate", "House of Representatives", "Parliament", "Duma"],
        answer: "House of Representatives",
        level: 2
      },
      {
        quiz: "Politics",
        question: "In which city is the European Parliament primarily located?",
        options: ["Brussels", "Berlin", "Strasbourg", "Paris"],
        answer: "Strasbourg",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Who was the first female Prime Minister of the United Kingdom?",
        options: ["Theresa May", "Margaret Thatcher", "Angela Merkel", "Indira Gandhi"],
        answer: "Margaret Thatcher",
        level: 2
      },
      {
        quiz: "Politics",
        question: "What is the standard voting age in most democratic countries?",
        options: ["16", "18", "21", "25"],
        answer: "18",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Which ideology advocates for common ownership of the means of production?",
        options: ["Capitalism", "Communism", "Liberalism", "Fascism"],
        answer: "Communism",
        level: 2
      },
      {
        quiz: "Politics",
        question: "Who is the current Chancellor of Germany?",
        options: ["Angela Merkel", "Olaf Scholz", "Gerhard Schröder", "Helmut Kohl"],
        answer: "Olaf Scholz",
        level: 2
      },
      {
        quiz: "Politics",
        question: "What is the term length for a US Senator?",
        options: ["2 years", "4 years", "6 years", "8 years"],
        answer: "6 years",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the hardest natural substance on Earth?",
        options: ["Gold", "Iron", "Diamond", "Quartz"],
        answer: "Diamond",
        level: 2
      },
      {
        quiz: "Nature",
        question: "Which planet has the most moons?",
        options: ["Mars", "Jupiter", "Saturn", "Neptune"],
        answer: "Saturn",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the largest desert in the world?",
        options: ["Sahara", "Gobi", "Antarctic", "Arabian"],
        answer: "Antarctic",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the main gas in Earth's atmosphere?",
        options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"],
        answer: "Nitrogen",
        level: 2
      },
      {
        quiz: "Nature",
        question: "Which animal is known as the 'King of the Jungle'?",
        options: ["Tiger", "Elephant", "Lion", "Gorilla"],
        answer: "Lion",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the process of water turning into vapor?",
        options: ["Condensation", "Evaporation", "Precipitation", "Sublimation"],
        answer: "Evaporation",
        level: 2
      },
      {
        quiz: "Nature",
        question: "How many hearts does an octopus have?",
        options: ["1", "2", "3", "4"],
        answer: "3",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the tallest grass in the world?",
        options: ["Wheat", "Bamboo", "Sugarcane", "Kentucky Bluegrass"],
        answer: "Bamboo",
        level: 2
      },
      {
        quiz: "Nature",
        question: "Which bird cannot fly but is a great swimmer?",
        options: ["Ostrich", "Emu", "Penguin", "Kiwi"],
        answer: "Penguin",
        level: 2
      },
      {
        quiz: "Nature",
        question: "What is the largest reef system in the world?",
        options: ["Belize Barrier Reef", "Great Barrier Reef", "Red Sea Coral Reef", "Pulley Ridge"],
        answer: "Great Barrier Reef",
        level: 2
      }
    ]);

    process.exit();
  } catch (err) {
    console.error("❌ Error inserting data:", err);
    process.exit(1);
  }
}

seedData();

