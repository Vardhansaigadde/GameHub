// Word bank for Draw & Guess. Movies come from the emoji list (well-known films) plus a few more.
const emojiMovies = require('./emoji-movies').map(m => m.a[0]);

const movies = [...new Set([...emojiMovies, 'Kushi', 'Jalsa', 'Bunny', 'Mirchi', 'Dhee', 'Aagadu', 'Krack', 'Vakeel Saab', 'Leader', 'Darling', 'Billa', 'Rebel', 'Chirutha', 'Nuvve Nuvve', 'Ninne Pelladata', 'Sontham', 'Anand', 'Kalyana Vaibhogame', 'Mahanubhavudu', 'Ninnu Kori'])];

const food = [
  'Biryani', 'Dosa', 'Idli', 'Vada', 'Upma', 'Pesarattu', 'Pulihora', 'Gongura', 'Mirchi Bajji', 'Samosa',
  'Pani Puri', 'Jalebi', 'Laddu', 'Gulab Jamun', 'Ice Cream', 'Pizza', 'Burger', 'Noodles', 'Chapati', 'Poori',
  'Curd Rice', 'Sambar', 'Rasam', 'Pickle', 'Mango', 'Banana', 'Coconut', 'Watermelon', 'Sugarcane', 'Tea',
  'Coffee', 'Popcorn', 'Chocolate', 'Cake', 'Egg', 'Chicken', 'Fish Fry', 'Paneer', 'Pongal', 'Bobbatlu',
];

const things = [
  'Charminar', 'Tirupati', 'Auto Rickshaw', 'Bus', 'Train', 'Aeroplane', 'Bicycle', 'Scooter', 'Cricket Bat', 'Kite',
  'Umbrella', 'Mobile Phone', 'Laptop', 'Television', 'Ceiling Fan', 'Pressure Cooker', 'Temple', 'Beach', 'Lighthouse', 'Rainbow',
  'Elephant', 'Peacock', 'Cow', 'Monkey', 'Snake', 'Tiger', 'Parrot', 'Mosquito', 'Coconut Tree', 'Lotus',
  'Rangoli', 'Diya', 'Crackers', 'Wedding', 'Mehendi', 'Saree', 'Lungi', 'Sunglasses', 'Toothbrush', 'Alarm Clock',
  'Haircut', 'Selfie', 'Traffic Jam', 'Exam', 'Teacher', 'Doctor', 'Police', 'Cinema Hall', 'Hospital', 'School Bag',
  'Ghost', 'Rocket', 'Moon', 'Volcano', 'Waterfall', 'Bridge', 'Castle', 'King', 'Crown', 'Sword',
];

module.exports = { movies, food, things };
