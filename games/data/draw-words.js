// Word bank for Draw & Guess: four themes, each with three levels of drawing difficulty.
const emojiMovies = require('./emoji-movies').map(m => m.a[0]);

const allMovies = [...new Set([...emojiMovies, 'Kushi', 'Jalsa', 'Bunny', 'Dhee', 'Aagadu', 'Krack', 'Vakeel Saab', 'Leader', 'Darling', 'Billa', 'Rebel', 'Chirutha', 'Nuvve Nuvve', 'Ninne Pelladata', 'Sontham', 'Anand', 'Kalyana Vaibhogame', 'Mahanubhavudu', 'Ninnu Kori'])];
const moviesEasy = ['Eega', 'RRR', 'Baahubali', 'Pushpa', 'Jersey', 'Kick', 'Sye', 'Shiva', 'Indra', 'Temper', 'Ready', 'Mirchi', 'Ghazi', 'Businessman', 'Race Gurram', 'Manam', 'Happy Days', 'Bommarillu', 'Bunny', 'Darling', 'Leader', 'Rebel'];
const moviesMedium = ['Magadheera', 'Arjun Reddy', 'Pokiri', 'Athadu', 'Okkadu', 'Rangasthalam', 'Srimanthudu', 'Fidaa', 'Gabbar Singh', 'Simhadri', 'Yamadonga', 'Dookudu', 'Salaar', 'Devara', 'HanuMan', 'Uppena', 'Dasara', 'Akhanda', 'Julayi', 'Oopiri', 'Tholi Prema', 'Premam', 'Majili', 'Geetha Govindam', 'Mahanati', 'Sita Ramam', 'Kalki 2898 AD', 'Chatrapathi'];

const THEMES = {
  movies: {
    label: 'Movie',
    easy: moviesEasy,
    medium: moviesMedium,
    hard: allMovies.filter(m => !moviesEasy.includes(m) && !moviesMedium.includes(m)),
  },
  food: {
    label: 'Food',
    easy: ['Dosa', 'Idli', 'Pizza', 'Burger', 'Ice Cream', 'Banana', 'Mango', 'Egg', 'Cake', 'Watermelon', 'Coconut', 'Tea', 'Popcorn', 'Chocolate', 'Apple', 'Laddu', 'Grapes', 'Noodles'],
    medium: ['Biryani', 'Samosa', 'Vada', 'Jalebi', 'Pani Puri', 'Gulab Jamun', 'Chapati', 'Poori', 'Sugarcane', 'Coffee', 'Chicken', 'Fish Fry', 'Pickle', 'Mirchi Bajji', 'Sandwich', 'Omelette', 'Sambar', 'Curd Rice', 'Thali', 'Lassi'],
    hard: ['Upma', 'Pesarattu', 'Pulihora', 'Gongura', 'Rasam', 'Paneer', 'Pongal', 'Bobbatlu', 'Haleem', 'Ghee Roast', 'Filter Coffee', 'Kheer', 'Mysore Pak', 'Dal', 'Chutney', 'Avakaya', 'Bisi Bele Bath', 'Ragi Mudde', 'Butter Chicken', 'Putharekulu'],
  },
  things: {
    label: 'Thing',
    easy: ['Bus', 'Train', 'Bicycle', 'Umbrella', 'Kite', 'Laptop', 'Television', 'Moon', 'Rainbow', 'Rocket', 'Crown', 'Sword', 'Ghost', 'Castle', 'Sunglasses', 'Toothbrush', 'Cricket Bat', 'Mobile Phone', 'Bridge', 'Clock'],
    medium: ['Charminar', 'Auto Rickshaw', 'Aeroplane', 'Scooter', 'Ceiling Fan', 'Pressure Cooker', 'Temple', 'Beach', 'Lighthouse', 'Rangoli', 'Diya', 'Crackers', 'Saree', 'Lungi', 'Alarm Clock', 'Volcano', 'Waterfall', 'School Bag', 'Hospital', 'Cinema Hall', 'Wedding', 'Mehendi'],
    hard: ['Traffic Jam', 'Haircut', 'Selfie', 'Exam', 'Power Cut', 'Tirupati', 'Bargaining', 'Group Photo', 'Online Class', 'Gravity', 'Jealousy', 'Monday Morning', 'Election', 'Job Interview', 'Stomach Ache', 'Echo', 'Sleepwalking', 'Stage Fear', 'Monsoon', 'Salary Day', 'Last Bench', 'Hide and Seek', 'Earthquake', 'Time Machine', 'Black Hole'],
  },
  animals: {
    label: 'Animal',
    easy: ['Elephant', 'Cow', 'Snake', 'Fish', 'Cat', 'Dog', 'Lion', 'Tiger', 'Monkey', 'Giraffe', 'Butterfly', 'Rabbit', 'Spider', 'Duck', 'Turtle'],
    medium: ['Peacock', 'Parrot', 'Mosquito', 'Crocodile', 'Kangaroo', 'Penguin', 'Buffalo', 'Camel', 'Zebra', 'Octopus', 'Owl', 'Goat', 'Frog', 'Bat', 'Squirrel'],
    hard: ['Chameleon', 'Seahorse', 'Platypus', 'Woodpecker', 'Hedgehog', 'Jellyfish', 'Firefly', 'Flamingo', 'Lizard', 'Scorpion', 'Sloth', 'Anteater', 'Stingray', 'Hornbill', 'Mongoose'],
  },
};

module.exports = { THEMES };
