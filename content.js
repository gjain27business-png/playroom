// All app content lives here. Add/edit freely — no code changes needed.

const QUESTIONS = [
  "What's one small thing I do that always makes you smile?",
  "If we could teleport anywhere for one evening, where would we go?",
  "What was your very first impression of me — honestly?",
  "Which moment of ours would you relive if you could?",
  "What's something you've never told me but want to?",
  "What does a perfect lazy Sunday together look like to you?",
  "Which song reminds you of us, and why?",
  "What's a habit of mine you secretly find cute?",
  "What's one thing you want us to try together this year?",
  "When do you feel most loved by me?",
  "What's your favourite photo of us, and what was happening?",
  "If our relationship was a movie, what would it be called?",
  "What's something you're proud of me for lately?",
  "What's a dream you haven't said out loud yet?",
  "What's the best gift you've ever received — from anyone?",
  "Which of my friends or family do you get along with best?",
  "What would our dream home have that most homes don't?",
  "What's one thing we argue about that's actually kind of funny?",
  "What do you need more of from me this week?",
  "What's your favourite way to be comforted when you're sad?",
  "What tiny thing made your day better today?",
  "If we had a couple's motto, what would it be?",
  "What's something about your childhood you wish I'd seen?",
  "What's your favourite food memory with me?",
  "What scares you a little about the future — and what excites you?",
  "What's one thing I do that you'd never want me to change?",
  "Which fictional couple are we most like?",
  "What's a date we've never done but should?",
  "What do you think I'm secretly great at?",
  "How do you like to celebrate your birthday — really?",
  "What does 'home' mean to you?",
  "What's a compliment you'd love to hear more often?",
  "What's the most spontaneous thing you want us to do?",
  "What's one place you want to take me to from your past?",
  "When did you first realise you really liked me?",
  "What would you name our pet (real or imaginary)?",
  "What's a tradition you want us to start?",
  "What's the funniest thing that's happened to us?",
  "What's one thing you want to learn together?",
  "What do you think we'll be doing 10 years from now on a Saturday?",
  "What makes you feel most understood?",
  "What's a small promise you'd like us to make to each other?",
  "What's the best advice about love you've ever heard?",
  "What's your love-language move when I'm stressed?",
  "What's one thing you'd like us to do more often?",
  "What's a fear you've overcome — or want to?",
  "What would your perfect anniversary look like?",
  "If you could ask my younger self one question, what would it be?",
  "What do you admire most about how I treat people?",
  "What made you laugh the hardest this month?",
  "What's one thing on your mind that you haven't shared yet?",
  "Describe us in three words.",
  "What's a movie or show you want us to watch together next?",
  "What's your favourite thing about our conversations?",
  "What do you want our next trip to feel like?",
  "Which version of me do you love most — morning me or night me?",
  "What's something you're grateful for about us today?",
  "What's a goal you want me to cheer you on for?",
  "If today was our last free day for a month, how would you spend it with me?",
  "What do you think our biggest strength as a couple is?"
];

const THIS_OR_THAT = [
  ["Mountains", "Beaches"], ["Chai", "Coffee"], ["Movie night in", "Dinner out"],
  ["Sunrise", "Sunset"], ["Road trip", "Flight"], ["Texting", "Calling"],
  ["Sweet", "Spicy"], ["Early bird", "Night owl"], ["Dogs", "Cats"],
  ["Plan everything", "Go with the flow"], ["Rain", "Sunshine"], ["Street food", "Fine dining"],
  ["Books", "Podcasts"], ["Big party", "Small gathering"], ["Comedy", "Thriller"],
  ["Cuddle", "Space"], ["Handwritten letter", "Surprise gift"], ["City life", "Small town"],
  ["Pizza", "Biryani"], ["Gym", "Long walk"], ["Window seat", "Aisle seat"],
  ["Breakfast in bed", "Midnight snack"], ["Old songs", "New songs"], ["Winter", "Summer"],
  ["Surprise date", "Planned date"], ["Matching outfits", "No way"], ["Photos", "Videos"],
  ["Cook together", "Order in"], ["Save money", "Spend on experiences"], ["Board games", "Video games"],
  ["Hugs", "Kisses"], ["Long chats", "Comfortable silence"], ["Hills trip", "Beach resort"],
  ["Ice cream", "Chocolate"], ["Bollywood", "Hollywood"], ["Morning walk", "Late-night drive"],
  ["Big wedding", "Intimate wedding"], ["Instagram story", "Keep it private"], ["Netflix", "YouTube"],
  ["Pani puri", "Momos"]
];

const TRUTH_OR_DARE = {
  sweet: {
    truths: [
      "What's the first thing you noticed about me?",
      "What's your favourite memory of us?",
      "What nickname do you secretly want me to call you?",
      "When did you last think about me today?",
      "What's one thing you love about my family?",
      "What song makes you think of me?",
      "What's the sweetest thing I've ever done for you?",
      "What do you miss most when we're apart?",
      "What's your favourite outfit of mine?",
      "What's one thing you'd thank me for right now?"
    ],
    dares: [
      "Send me a voice note saying three things you love about me.",
      "Do your best impression of me.",
      "Show me the oldest photo of us on your phone.",
      "Sing one line of 'our song'.",
      "Write me a two-line poem right now.",
      "Give me a 20-second compliment speech without pausing.",
      "Set a photo of us as your wallpaper for a day.",
      "Plan our next date in 60 seconds, out loud."
    ]
  },
  flirty: {
    truths: [
      "What's the most attractive thing I do without realising it?",
      "When did you first want to kiss me?",
      "What outfit of mine is your weakness?",
      "What's a date you've fantasised about with me?",
      "What's the cheesiest line you'd use on me?",
      "What do you think about when you can't sleep?",
      "Rate our first kiss out of 10 — honestly.",
      "Which feature of mine do you stare at the most?",
      "What's something I say that gives you butterflies?",
      "What would you do if we had the whole day alone?"
    ],
    dares: [
      "Text me the most romantic message you can in 30 seconds.",
      "Describe our perfect date in five words.",
      "Give me your best pickup line — and commit to it.",
      "Hold eye contact with me for 30 seconds without laughing.",
      "Slow-dance with me to the next song (call or in person).",
      "Tell me what you'd whisper to me right now.",
      "Recreate our first selfie together.",
      "Show me your most charming smile for 10 seconds."
    ]
  },
  spicy: {
    truths: [
      "What's something you'd like us to try that we haven't yet?",
      "What's your favourite way for me to show affection?",
      "Where's the most adventurous place you'd want to go with me?",
      "What's one thing I do that drives you a little crazy — in a good way?",
      "What's a secret crush you had before me?",
      "What's the boldest thing you've ever done for love?",
      "What's your guilty-pleasure romantic movie scene?",
      "What would make our next night together unforgettable?"
    ],
    dares: [
      "Plan a surprise for me within the next week — no hints.",
      "Tell me your boldest compliment for me.",
      "Pick a date night theme and we must do it this week.",
      "Describe me in the most dramatic romantic-novel style.",
      "Send me a selfie with your best 'come here' look.",
      "Whisper (or voice-note) your favourite thing about me."
    ]
  }
};

// Love language quiz: each question has two options mapped to a language key.
// W=Words of affirmation, T=Quality time, G=Gifts, S=Acts of service, P=Physical touch
const LOVE_LANGUAGES = {
  W: { name: "Words of Affirmation", tip: "Say it out loud — compliments, 'I'm proud of you', sweet texts." },
  T: { name: "Quality Time", tip: "Phone away, full attention. Plan time that's only about you two." },
  G: { name: "Thoughtful Gifts", tip: "Small surprises that show 'I thought of you' matter more than price." },
  S: { name: "Acts of Service", tip: "Help without being asked — handle a chore, make their day easier." },
  P: { name: "Physical Touch", tip: "Hugs, holding hands, sitting close. Presence they can feel." }
};

const QUIZZES = {
  love: {
    title: "Love Language",
    subtitle: "Find out how you each feel most loved",
    type: "choice",
    questions: [
      { q: "After a long day, I'd rather my partner…", options: [["Tell me how much they appreciate me", "W"], ["Sit with me, phones away", "T"]] },
      { q: "I feel most cared for when my partner…", options: [["Brings me a little surprise", "G"], ["Takes a task off my plate", "S"]] },
      { q: "The best way to cheer me up is…", options: [["A long, warm hug", "P"], ["A kind, encouraging message", "W"]] },
      { q: "On my birthday I'd love…", options: [["A full day together", "T"], ["A thoughtful gift", "G"]] },
      { q: "I feel closest when we…", options: [["Hold hands or cuddle", "P"], ["Have a deep conversation", "T"]] },
      { q: "It means a lot when my partner…", options: [["Fixes something for me", "S"], ["Says 'I'm proud of you'", "W"]] },
      { q: "A perfect surprise would be…", options: [["A handwritten note", "W"], ["Something I mentioned once", "G"]] },
      { q: "When I'm stressed I want my partner to…", options: [["Help me get things done", "S"], ["Hold me close", "P"]] },
      { q: "I'd feel hurt if my partner…", options: [["Was always distracted around me", "T"], ["Forgot a special occasion", "G"]] },
      { q: "Love, to me, is…", options: [["Being there and helping out", "S"], ["Feeling them close", "P"]] }
    ]
  },
  values: {
    title: "Values Match",
    subtitle: "See where you're aligned — and what to talk about",
    type: "scale",
    questions: [
      "Saving money matters more than spending on fun right now.",
      "I want to live close to family in the future.",
      "Having kids is important to me.",
      "Career growth is a top priority for me in the next 5 years.",
      "We should share all our finances.",
      "I need regular alone time to recharge.",
      "Travelling often is a big part of the life I want.",
      "Religion or spirituality is important in my daily life.",
      "Household chores should be split exactly equally.",
      "I'd be open to moving to another city or country."
    ]
  }
};

const MOODS = [
  ["🥰", "In love"], ["😊", "Happy"], ["😴", "Tired"], ["🤯", "Stressed"],
  ["🥺", "Missing you"], ["😤", "Grumpy"], ["🤒", "Not well"], ["💼", "Busy, call later"],
  ["🎉", "Excited"], ["😌", "Calm"], ["🍕", "Hungry"], ["🫂", "Need a hug"]
];

// Fallback date ideas when no AI key is configured.
// budget: free | low | mid | splurge   vibe: cozy | adventure | foodie | creative | distance
const DATE_IDEAS = [
  { title: "Sunrise chai date", description: "Wake up early, grab chai and watch the sunrise somewhere high.", budget: "free", vibe: "cozy" },
  { title: "Home film festival", description: "Each picks two movies, make a menu, rate them like critics.", budget: "free", vibe: "cozy" },
  { title: "Memory lane walk", description: "Revisit where you first met or had your first date.", budget: "free", vibe: "cozy" },
  { title: "Stargazing night", description: "Drive out of the city lights with a blanket and snacks.", budget: "free", vibe: "adventure" },
  { title: "Cook a dish from each other's childhood", description: "Teach each other a family recipe.", budget: "low", vibe: "foodie" },
  { title: "Street food crawl", description: "Pick 5 stalls, share one plate at each, crown a winner.", budget: "low", vibe: "foodie" },
  { title: "Paint each other", description: "Cheap canvases, 30 minutes, no peeking. Reveal together.", budget: "low", vibe: "creative" },
  { title: "Thrift challenge", description: "₹500 each to find the best outfit for the other.", budget: "low", vibe: "creative" },
  { title: "Picnic in the park", description: "Homemade sandwiches, a speaker and a board game.", budget: "low", vibe: "cozy" },
  { title: "Bookstore date", description: "Pick a book for each other and write a note inside.", budget: "low", vibe: "creative" },
  { title: "Pottery or art workshop", description: "Make something together you can keep at home.", budget: "mid", vibe: "creative" },
  { title: "Trek and maggi", description: "A short trek with maggi at the top.", budget: "mid", vibe: "adventure" },
  { title: "Rooftop dinner", description: "Book a rooftop table and dress up a little.", budget: "mid", vibe: "foodie" },
  { title: "Go-karting or bowling", description: "Loser plans the next date.", budget: "mid", vibe: "adventure" },
  { title: "Live music night", description: "Find a small café gig or open mic.", budget: "mid", vibe: "cozy" },
  { title: "Cooking class", description: "Learn a new cuisine together.", budget: "mid", vibe: "foodie" },
  { title: "Weekend getaway", description: "A homestay in the hills, no laptops allowed.", budget: "splurge", vibe: "adventure" },
  { title: "Spa day for two", description: "Couple massage and a slow lunch after.", budget: "splurge", vibe: "cozy" },
  { title: "Fine-dining tasting menu", description: "Try a chef's tasting menu and rate every course.", budget: "splurge", vibe: "foodie" },
  { title: "Hot air balloon / paragliding", description: "Tick a big one off the bucket list.", budget: "splurge", vibe: "adventure" },
  { title: "Synced movie night", description: "Start the same movie at the same time on a call.", budget: "free", vibe: "distance" },
  { title: "Same recipe, two kitchens", description: "Cook the same dish on video call and eat together.", budget: "low", vibe: "distance" },
  { title: "Virtual city tour", description: "Show each other your neighbourhood on a video walk.", budget: "free", vibe: "distance" },
  { title: "Surprise delivery", description: "Order the other's favourite dessert to their door.", budget: "low", vibe: "distance" },
  { title: "Online game night", description: "Play Duo's This or That and Truth or Dare on a call.", budget: "free", vibe: "distance" },
  { title: "Write letters, open together", description: "Post real letters and open them on the same call.", budget: "low", vibe: "distance" }
];

module.exports = { QUESTIONS, THIS_OR_THAT, TRUTH_OR_DARE, LOVE_LANGUAGES, QUIZZES, MOODS, DATE_IDEAS };
