import type { ContentItem, ContentPack, GameId, Suitability } from '../domain/shared/contracts.ts'
import { asContentId, asPackId } from '../domain/shared/ids.ts'
import { parseContentItem, parseContentPack } from '../domain/shared/validation.ts'
import { IMPOSTER_CATEGORY_BANKS } from './imposter-categories.ts'

const CREATED_AT = Date.UTC(2026, 10, 3)
const LICENSE = 'LicenseRef-Project-Original'
const SOURCE = 'project-original:seed-pack-v1'
const CREATOR = 'party-game-portal'
const DEFAULT_SUITABILITY: Suitability = 'general'

const IMPOSTER_CATEGORY_CLUES: Readonly<Record<string, string>> = {
  Animals: 'Living creature',
  Fruit: 'Edible produce',
  'Food & Drinks': 'Prepared dish',
  Objects: 'Physical item',
  Celebrities: 'Public figure',
  Cities: 'Urban location',
  Countries: 'Nation state',
  'Body & Health': 'Body feature',
  Brands: 'Consumer label',
  Hollywood: 'Film performer',
  Games: 'Playable title',
  Locations: 'Specific place',
  'Film & TV': 'Screen story',
  Anime: 'Animated title',
  Professions: 'Work role',
  School: 'Learning topic',
  Sports: 'Athletic activity',
  Football: 'Football term',
  Fantasy: 'Imagined thing',
  'Fashion & Clothes': 'Clothing item',
  Technology: 'Digital device',
  Traveling: 'Travel item',
  'World & Places': 'Famous landmark',
  Summer: 'Warm-weather item',
  Music: 'Musical item',
  'Jobs & Crafts': 'Hands-on craft',
  'Daily Life': 'Everyday item',
  'Adults Only': 'Adult responsibility',
  Superheroes: 'Comic-book hero',
  'Weather & Nature': 'Natural feature',
}

function getSeededImposterHints(word: string, categoryName: string): readonly string[] {
  const letters = [...word.normalize('NFKC').matchAll(/[\p{L}\p{N}]/gu)].length
  const words = word.trim().split(/\s+/).filter(Boolean).length
  const categoryClue = IMPOSTER_CATEGORY_CLUES[categoryName] ?? 'Category item'
  return [
    categoryClue,
    `${letters} letters`,
    words > 1 ? 'Multiple words' : 'Single word',
  ]
}

type SeedDefinition = {
  readonly gameId: GameId
  readonly packId: string
  readonly packName: string
  readonly description: string
  readonly kind: ContentItem['kind']
  readonly categoryId: string
  readonly suitability?: Suitability
  readonly entries: readonly (readonly [string, string, string?])[]
}

const DEFINITIONS: readonly SeedDefinition[] = [
  {
    gameId: 'guessup',
    packId: 'pack-guessup-quick-scenes-v1',
    packName: 'Quick Scenes',
    description: 'Easy-to-act activities, characters, and everyday situations.',
    kind: 'phrase',
    categoryId: 'quick-scenes',
    entries: [
      ['guess-tightrope', 'Walking a tightrope'], ['guess-puppy', 'A puppy chasing its tail'],
      ['guess-chef', 'A chef flipping pancakes'], ['guess-snowman', 'Building a snowman'],
      ['guess-astronaut', 'Floating in space'], ['guess-dentist', 'A dentist checking teeth'],
      ['guess-juggling', 'Juggling too many things'], ['guess-tornado', 'A tiny tornado'],
      ['guess-librarian', 'A librarian shushing a room'], ['guess-dragon', 'A dragon with hiccups'],
      ['guess-rollercoaster', 'Riding a roller coaster'], ['guess-photographer', 'Taking a group photo'],
      ['guess-ballet', 'Dancing ballet'], ['guess-cat', 'A cat knocking a glass off a table'],
      ['guess-firefighter', 'A firefighter climbing a ladder'], ['guess-pirate', 'A pirate spotting treasure'],
      ['guess-birthday', 'Blowing out birthday candles'], ['guess-sneeze', 'Trying to hold in a sneeze'],
      ['guess-mime', 'A mime trapped in an invisible box'], ['guess-gardener', 'Watering a very thirsty plant'],
      ['guess-moonwalk', 'Moonwalking across a room'], ['guess-surf', 'Surfing a giant wave'],
      ['guess-robot', 'A robot learning to dance'], ['guess-babysitter', 'A babysitter calming a crying baby'],
      ['guess-magic', 'A magician pulling a rabbit from a hat'], ['guess-train', 'Conducting a train'],
      ['guess-cheerleader', 'A cheerleader leading a chant'], ['guess-sleepy', 'Falling asleep during a movie'],
      ['guess-hiccup', 'Trying to stop a hiccup'], ['guess-jar', 'Opening a stubborn jar'],
      ['guess-dog', 'A dog chasing a ball'], ['guess-ice-skate', 'Ice skating for the first time'],
      ['guess-juggler', 'A street performer juggling oranges'], ['guess-waiter', 'A waiter carrying too many plates'],
      ['guess-photobomb', 'Photobombing a group picture'], ['guess-lifeguard', 'A lifeguard spotting someone in trouble'],
      ['guess-zookeeper', 'A zookeeper feeding a giraffe'], ['guess-painter', 'Painting a ceiling'],
      ['guess-superhero', 'A superhero landing dramatically'], ['guess-ghost', 'A ghost trying to scare someone'],
      ['guess-pizza', 'Making a pizza from scratch'], ['guess-mountain', 'Climbing a steep mountain'],
      ['guess-boxing', 'Shadowboxing in front of a mirror'], ['guess-snowball', 'Starting a snowball fight'],
      ['guess-detective', 'A detective examining tiny clues'], ['guess-bike', 'Riding a mountain bike downhill'],
      ['guess-birdwatch', 'Trying to photograph a tiny bird'], ['guess-orchestra', 'Conducting a full orchestra'],
    ],
  },
  {
    gameId: 'truth-or-dare',
    packId: 'pack-truth-dare-light-v1',
    packName: 'Light & Lively',
    description: 'Low-pressure questions and opt-in, no-risk dares for mixed groups.',
    kind: 'truth',
    categoryId: 'truth',
    entries: [
      ['td-truth-1', 'What small thing instantly improves your day?'],
      ['td-truth-2', 'Which skill would you learn if it took only one afternoon?'],
      ['td-truth-3', 'What is a harmless hill you are willing to die on?'],
      ['td-truth-4', 'Which fictional place would you visit for a weekend?'],
      ['td-truth-5', 'What is the funniest name you have given an object?'],
      ['td-truth-6', 'What song do you know almost entirely by heart?'],
      ['td-truth-7', 'What is a tiny everyday luxury you genuinely enjoy?'],
      ['td-truth-8', 'Which fictional character would make the funniest roommate?'],
      ['td-truth-9', 'What is something you were convinced was true as a child?'],
      ['td-truth-10', 'What is your most oddly specific talent?'],
      ['td-truth-11', 'Which food combination do you defend even when people judge it?'],
      ['td-truth-12', 'What is the most spontaneous thing you have done recently?'],
    ],
  },
  {
    gameId: 'truth-or-dare',
    packId: 'pack-truth-dare-light-v1',
    packName: 'Light & Lively',
    description: 'Low-pressure questions and opt-in, no-risk dares for mixed groups.',
    kind: 'dare',
    categoryId: 'dare',
    entries: [
      ['td-dare-1', 'Narrate the next 20 seconds like a nature documentary.'],
      ['td-dare-2', 'Invent a three-step dance and teach it to the group.'],
      ['td-dare-3', 'Describe a common object as if it were a luxury product.'],
      ['td-dare-4', 'Draw an animal in 15 seconds and let the group guess it.'],
      ['td-dare-5', 'Give a dramatic weather report for the room.'],
      ['td-dare-6', 'Hum a tune and let the group guess the song.'],
      ['td-dare-7', 'Give a one-minute award speech for an ordinary object nearby.'],
      ['td-dare-8', 'Explain how to make a sandwich like a dramatic sports commentator.'],
      ['td-dare-9', 'Make up a new holiday and describe its traditions.'],
      ['td-dare-10', 'Do a weather forecast for the room using only gestures.'],
      ['td-dare-11', 'Describe your current outfit as if it were on a fashion runway.'],
      ['td-dare-12', 'Invent a mascot for the group and demonstrate its signature pose.'],
    ],
  },
  {
    gameId: 'never-have-i-ever',
    packId: 'pack-never-have-i-ever-general-v1',
    packName: 'First Impressions',
    description: 'Friendly, inclusive prompts with neutral response options.',
    kind: 'never-have-i-ever',
    categoryId: 'general',
    entries: [
      ['nhie-1', 'Never have I ever waved back at someone who was waving at a different person.'],
      ['nhie-2', 'Never have I ever forgotten why I walked into a room.'],
      ['nhie-3', 'Never have I ever named a plant or a household object.'],
      ['nhie-4', 'Never have I ever laughed at a joke before understanding it.'],
      ['nhie-5', 'Never have I ever rehearsed a conversation in my head.'],
      ['nhie-6', 'Never have I ever packed for a trip and still forgotten something obvious.'],
      ['nhie-7', 'Never have I ever tried to quietly open a noisy snack.'],
      ['nhie-8', 'Never have I ever mistaken a stranger for someone I know.'],
      ['nhie-9', 'Never have I ever sent a message to the wrong chat.'],
      ['nhie-10', 'Never have I ever walked into the wrong room with confidence.'],
      ['nhie-11', 'Never have I ever forgotten a password immediately after changing it.'],
      ['nhie-12', 'Never have I ever pretended to understand a board game before learning the rules.'],
      ['nhie-13', 'Never have I ever started a hobby because of one video.'],
      ['nhie-14', 'Never have I ever taken a photo and then immediately forgotten about it.'],
      ['nhie-15', 'Never have I ever looked for something that was already in my hand.'],
      ['nhie-16', 'Never have I ever laughed at the wrong moment by accident.'],
      ['nhie-17', 'Never have I ever practiced a facial expression before taking a photo.'],
      ['nhie-18', 'Never have I ever made up a name for a pet I do not own.'],
      ['nhie-19', 'Never have I ever opened the fridge without knowing what I wanted.'],
      ['nhie-20', 'Never have I ever waved goodbye and then walked in the same direction as the person.'],
    ],
  },
]


const ARCADE_DEFINITIONS: readonly SeedDefinition[] = [
  { gameId: 'timer-impostor', packId: 'pack-timer-impostor-basics-v1', packName: 'Secret Seconds', description: 'A shared hidden target time for the whole group.', kind: 'party-prompt', categoryId: 'timer', entries: [['timer-round-1', 'Count the same secret number of seconds in your head, then stop.']] },
  { gameId: 'werewolf', packId: 'pack-werewolf-classic-v1', packName: 'Classic Village', description: 'Classic Werewolf roles and narrated night/day rounds.', kind: 'party-prompt', categoryId: 'rules', entries: [['wolf-round-1', 'The village sleeps. Werewolves choose one victim. The village discusses and votes at dawn.']] },
  { gameId: 'mafia', packId: 'pack-mafia-classic-v1', packName: 'Classic City', description: 'Classic Mafia roles and narrated night/day rounds.', kind: 'party-prompt', categoryId: 'rules', entries: [['mafia-round-1', 'The city sleeps. Mafia choose one victim. The city discusses and votes at dawn.']] },
  { gameId: 'murder', packId: 'pack-murder-classic-v1', packName: 'Wink & Witness', description: 'A silent murderer and a room full of witnesses.', kind: 'party-prompt', categoryId: 'rules', entries: [['murder-round-1', 'Keep your eyes open. The murderer eliminates players with a wink.']] },
  { gameId: 'fake-it', packId: 'pack-fake-it-bluff-v1', packName: 'Secret Word Categories', description: 'Broad categories for yes/no questioning and secret-word guesses.', kind: 'party-prompt', categoryId: 'bluff', entries: [
    ['fake-1', 'A planet in our solar system', 'Jupiter'], ['fake-2', 'An ocean on Earth', 'Pacific Ocean'], ['fake-3', 'A polygon with six sides', 'Hexagon'], ['fake-4', 'A gas absorbed by plants from the air', 'Carbon dioxide'], ['fake-5', 'The capital city of Japan', 'Tokyo'], ['fake-6', 'The tallest living land animal', 'Giraffe'], ['fake-7', 'A unit of time equal to sixty seconds', 'Minute'], ['fake-8', 'A naturally occurring gemstone known for its hardness', 'Diamond'], ['fake-9', 'A planet often called the Red Planet', 'Mars'], ['fake-10', 'The currency used in the United Kingdom', 'Pound sterling'],
  ] },
  { gameId: 'fake-story', packId: 'pack-fake-story-starters-v1', packName: 'Story Starters', description: 'Low-pressure story prompts for true or invented memories.', kind: 'party-prompt', categoryId: 'stories', entries: [
    ['story-1', 'Tell a story about a time a plan went completely wrong.'], ['story-2', 'Tell a story about an unexpected kindness.'], ['story-3', 'Tell a story about a time you got lost.'], ['story-4', 'Tell a story about a memorable first day.'], ['story-5', 'Tell a story about a strange coincidence.'], ['story-6', 'Tell a story about a small victory that felt huge.'], ['story-7', 'Tell a story about an awkward misunderstanding.'], ['story-8', 'Tell a story about a time you had to improvise.'], ['story-9', 'Tell a story about an unusual thing you found.'], ['story-10', 'Tell a story about a journey that took longer than expected.'],
  ] },
  { gameId: 'fact-or-fiction', packId: 'pack-fact-fiction-starters-v1', packName: 'Everyday Facts', description: 'True statements; one player is secretly instructed to lie.', kind: 'party-prompt', categoryId: 'facts', entries: [
    ['fact-1', 'Honey can remain edible for an exceptionally long time when sealed and stored well.', 'true'], ['fact-2', 'Octopuses have three hearts.', 'true'], ['fact-3', 'A day on Venus is longer than its year.', 'true'], ['fact-4', 'Bananas are botanically berries.', 'true'], ['fact-5', 'The Eiffel Tower can become slightly taller in hot weather.', 'true'], ['fact-6', 'Sharks existed before trees.', 'true'], ['fact-7', 'Sound travels faster in water than in air.', 'true'], ['fact-8', 'A group of flamingos is called a flamboyance.', 'true'], ['fact-9', 'The Moon produces its own visible light.', 'false'], ['fact-10', 'Humans have more than five senses when balance and body position are included.', 'true'],
  ] },
  { gameId: 'wrong-answers-only', packId: 'pack-wrong-answers-quick-v1', packName: 'Quick Questions', description: 'Simple questions that invite deliberately incorrect answers.', kind: 'party-prompt', categoryId: 'questions', entries: [
    ['wrong-1', 'What do you use to brush your teeth?'], ['wrong-2', 'What colour is the sky on a clear day?'], ['wrong-3', 'What do bees make?'], ['wrong-4', 'Which animal says meow?'], ['wrong-5', 'What do you wear on your feet?'], ['wrong-6', 'What is frozen water called?'], ['wrong-7', 'What do you use to write on paper?'], ['wrong-8', 'Which season is usually the coldest?'], ['wrong-9', 'What do you call a baby dog?'], ['wrong-10', 'What do you open to enter a room?'],
  ] },
  { gameId: 'hot-bomb', packId: 'pack-hot-bomb-mixed-v1', packName: 'Mixed Categories', description: 'Broad categories for fast, no-repeat answers.', kind: 'party-prompt', categoryId: 'mixed', entries: [
    ['bomb-1', 'Things you pack for a trip'], ['bomb-2', 'Things found in a kitchen'], ['bomb-3', 'Things that are round'], ['bomb-4', 'Things with wheels'], ['bomb-5', 'Things you can collect'], ['bomb-6', 'Things that make noise'], ['bomb-7', 'Things found at a beach'], ['bomb-8', 'Things that are usually cold'], ['bomb-9', 'Things people do before bed'], ['bomb-10', 'Things with a screen'],
  ] },
  { gameId: 'hot-bomb', packId: 'pack-hot-bomb-food-v1', packName: 'Food', description: 'Food and drink categories.', kind: 'party-prompt', categoryId: 'food', entries: [['food-1','Types of pasta'],['food-2','Pizza toppings'],['food-3','Fruit with a peel'],['food-4','Breakfast foods'],['food-5','Foods eaten with chopsticks'],['food-6','Things in a sandwich'],['food-7','Desserts served cold'],['food-8','Spices'],['food-9','Street foods'],['food-10','Foods that are crunchy']] },
  { gameId: 'hot-bomb', packId: 'pack-hot-bomb-animals-v1', packName: 'Animals', description: 'Animals, habitats and wildlife categories.', kind: 'party-prompt', categoryId: 'animals', entries: [['animal-1','Animals that live in water'],['animal-2','Animals with stripes'],['animal-3','Birds that cannot fly'],['animal-4','Animals found on a farm'],['animal-5','Animals that hibernate'],['animal-6','Big cats'],['animal-7','Animals with shells'],['animal-8','Nocturnal animals'],['animal-9','Animals that hop'],['animal-10','Animals with long necks']] },
  { gameId: 'hot-bomb', packId: 'pack-hot-bomb-sports-v1', packName: 'Sports', description: 'Sports, equipment and competition categories.', kind: 'party-prompt', categoryId: 'sports', entries: [['sport-1','Sports played with a ball'],['sport-2','Olympic sports'],['sport-3','Things in a gym'],['sport-4','Sports that use a racket'],['sport-5','Positions in football'],['sport-6','Things an athlete wears'],['sport-7','Winter sports'],['sport-8','Sports played in water'],['sport-9','Track and field events'],['sport-10','Things a referee uses']] },
  { gameId: 'hot-bomb', packId: 'pack-hot-bomb-party-v1', packName: 'Party Night', description: 'Social, music and celebration categories.', kind: 'party-prompt', categoryId: 'party', entries: [['party-1','Songs everyone knows'],['party-2','Party decorations'],['party-3','Reasons to celebrate'],['party-4','Things found at a festival'],['party-5','Dance styles'],['party-6','Board games'],['party-7','Things people bring to a picnic'],['party-8','Party snacks'],['party-9','Famous fictional characters'],['party-10','Things you do on a weekend']] },
  { gameId: 'hot-bomb-duel', packId: 'pack-hot-bomb-duel-duel-v1', packName: 'Duel Categories', description: 'Fast categories balanced for two players.', kind: 'party-prompt', categoryId: 'duel', entries: [['duel-1','Name a country'],['duel-2','Name a fruit'],['duel-3','Name a movie genre'],['duel-4','Name a musical instrument'],['duel-5','Name a city'],['duel-6','Name a sport'],['duel-7','Name a colour'],['duel-8','Name a school subject'],['duel-9','Name a vehicle'],['duel-10','Name a language']] },
  { gameId: 'whos-most-likely', packId: 'pack-most-likely-friends-v1', packName: 'The Friend Group', description: 'Light-hearted group vote prompts.', kind: 'party-prompt', categoryId: 'prompts', entries: [
    ['likely-1','Who is most likely to become famous by accident?'],['likely-2','Who is most likely to plan a trip at the last minute?'],['likely-3','Who is most likely to laugh at the wrong moment?'],['likely-4','Who is most likely to survive on snacks alone?'],['likely-5','Who is most likely to learn a new language for fun?'],['likely-6','Who is most likely to get lost while using a map?'],['likely-7','Who is most likely to start a spontaneous dance party?'],['likely-8','Who is most likely to remember everyone’s birthday?'],['likely-9','Who is most likely to adopt an unusual pet?'],['likely-10','Who is most likely to turn a small idea into a big project?'],
  ] },
  { gameId: 'would-you-rather', packId: 'pack-would-you-rather-classic-v1', packName: 'Impossible Choices', description: 'Two-choice dilemmas for group voting.', kind: 'party-prompt', categoryId: 'choices', entries: [
    ['wyr-1','Explore the ocean depths || Explore outer space'],['wyr-2','Always arrive 20 minutes early || Always arrive 10 minutes late'],['wyr-3','Give up music for a year || Give up movies for a year'],['wyr-4','Live by the sea || Live in the mountains'],['wyr-5','Have a pause button for life || Have a rewind button for life'],['wyr-6','Travel only by train || Travel only by boat'],['wyr-7','Be able to speak every language || Be able to play every instrument'],['wyr-8','Have a personal chef || Have a personal driver'],['wyr-9','Visit the past for one day || Visit the future for one day'],['wyr-10','Always have perfect weather || Always have perfect timing'],
  ] },
  { gameId: 'share-or-pass', packId: 'pack-share-pass-friendly-v1', packName: 'Open & Easy', description: 'Optional conversation prompts. Passing is always valid.', kind: 'party-prompt', categoryId: 'share', entries: [
    ['share-1','What is a small win you had this week?'],['share-2','What is a skill you wish more people noticed?'],['share-3','What is a place that makes you feel calm?'],['share-4','What is a kind thing someone did that you still remember?'],['share-5','What is a harmless opinion you will defend forever?'],['share-6','What is something new you would like to try?'],['share-7','What is a compliment you find easy to give?'],['share-8','What is one thing you want more time for?'],['share-9','What is a memory that makes you smile?'],['share-10','What is a boundary that helps you enjoy group activities?'],
  ] },
  { gameId: 'challenge-20', packId: 'pack-challenge-20-themes-v1', packName: 'Build Themes', description: 'Themes for a ten-lot, $20 auction draft.', kind: 'party-prompt', categoryId: 'themes', entries: [
    ['theme-1','Build the ultimate pirate ship'],['theme-2','Build your dream home cinema'],['theme-3','Build the perfect road-trip kit'],['theme-4','Build an unbeatable picnic'],['theme-5','Build a fantasy football team'],['theme-6','Build the ideal study setup'],['theme-7','Build a survival cabin'],['theme-8','Build a dream music festival'],['theme-9','Build the perfect beach day'],['theme-10','Build a tiny dream city'],
  ] },
  { gameId: 'tilt-it', packId: 'pack-tilt-it-mix-v1', packName: 'Everyday & Pop Culture', description: 'Guessable words and phrases for forehead play.', kind: 'party-prompt', categoryId: 'words', entries: [
    ['tilt-1','Time machine'],['tilt-2','Roller coaster'],['tilt-3','Dinosaur'],['tilt-4','Astronaut'],['tilt-5','Karaoke'],['tilt-6','Pancakes'],['tilt-7','Fireworks'],['tilt-8','Detective'],['tilt-9','Camping'],['tilt-10','Skateboard'],['tilt-11','Volcano'],['tilt-12','Photobooth'],['tilt-13','Treasure map'],['tilt-14','Snow globe'],['tilt-15','Magic trick'],['tilt-16','Air guitar'],['tilt-17','Lighthouse'],['tilt-18','Waterfall'],['tilt-19','Birthday cake'],['tilt-20','Superhero'],
  ] },
  { gameId: 'letterburg', packId: 'pack-letterburg-family-v1', packName: 'Little Word Parade', description: 'Simple, age-friendly words for family guessing.', kind: 'party-prompt', categoryId: 'family', entries: [
    ['letter-1','Apple'],['letter-2','Bicycle'],['letter-3','Butterfly'],['letter-4','Cloud'],['letter-5','Dolphin'],['letter-6','Elephant'],['letter-7','Flower'],['letter-8','Guitar'],['letter-9','Ice cream'],['letter-10','Jellyfish'],['letter-11','Kite'],['letter-12','Lemon'],['letter-13','Moon'],['letter-14','Noodles'],['letter-15','Octopus'],['letter-16','Penguin'],['letter-17','Rainbow'],['letter-18','Sunflower'],['letter-19','Turtle'],['letter-20','Watermelon'],
  ] },
  { gameId: 'discussion-starter', packId: 'pack-discussion-starter-group-v1', packName: 'Good Conversations', description: 'Open-ended questions for the whole group.', kind: 'party-prompt', categoryId: 'talk', entries: [
    ['talk-1','What is something you changed your mind about?'],['talk-2','What everyday invention deserves more appreciation?'],['talk-3','What makes a place feel like home?'],['talk-4','What is a tradition you would like to start?'],['talk-5','Which fictional world would be interesting to visit for one hour?'],['talk-6','What is one thing you learned later than you wish you had?'],['talk-7','What makes someone easy to work with?'],['talk-8','What is a small decision that had a big effect on you?'],['talk-9','What would you teach in a one-hour class?'],['talk-10','What is a question you wish people asked more often?'],
  ] },
  { gameId: 'who-am-i', packId: 'pack-who-am-i-people-v1', packName: 'Famous & Fictional', description: 'Identities for forehead guessing.', kind: 'party-prompt', categoryId: 'identities', entries: [
    ['identity-1','Sherlock Holmes'],['identity-2','Cleopatra'],['identity-3','Spider-Man'],['identity-4','Albert Einstein'],['identity-5','Wonder Woman'],['identity-6','Mario'],['identity-7','Mona Lisa'],['identity-8','Harry Potter'],['identity-9','Ada Lovelace'],['identity-10','Darth Vader'],['identity-11','Taylor Swift'],['identity-12','Charlie Chaplin'],['identity-13','SpongeBob SquarePants'],['identity-14','Neil Armstrong'],['identity-15','Wednesday Addams'],['identity-16','Batman'],['identity-17','Frida Kahlo'],['identity-18','Mickey Mouse'],['identity-19','Moana'],['identity-20','William Shakespeare'],
  ] },
  { gameId: 'ten-tangle', packId: 'pack-ten-tangle-words-v1', packName: 'Ten Words', description: 'Everyday words for a ten-item unscramble round.', kind: 'party-prompt', categoryId: 'words', entries: [
    ['tangle-1','PLANET'],['tangle-2','GARDEN'],['tangle-3','WINDOW'],['tangle-4','PUZZLE'],['tangle-5','MARKET'],['tangle-6','JOURNEY'],['tangle-7','ORANGE'],['tangle-8','LIBRARY'],['tangle-9','MUSIC'],['tangle-10','THUNDER'],['tangle-11','BICYCLE'],['tangle-12','HORIZON'],['tangle-13','KITCHEN'],['tangle-14','SUNSHINE'],['tangle-15','NOTEBOOK'],
  ] },
  { gameId: 'qupid', packId: 'pack-qupid-conversation-v1', packName: 'Qupid · Know Each Other', description: 'Original relationship questions. This is not a 1,000-question replica.', kind: 'party-prompt', categoryId: 'couples', entries: [
    ['qupid-1','What makes you feel most understood?'],['qupid-2','What does a really good ordinary day look like to you?'],['qupid-3','What is a memory you would like to relive together?'],['qupid-4','How do you prefer someone to support you after a difficult day?'],['qupid-5','What small ritual would you like us to create?'],['qupid-6','What is something you are proud of but rarely mention?'],['qupid-7','What does feeling at home with someone mean to you?'],['qupid-8','What is one thing you hope we learn together?'],['qupid-9','Which shared adventure would you choose next?'],['qupid-10','What helps you feel appreciated?'],
  ] },
  { gameId: 'questions-for-love', packId: 'pack-love-questions-v1', packName: 'Closer Conversations', description: 'Reflective prompts for two people.', kind: 'party-prompt', categoryId: 'couples', entries: [
    ['love-1','What is a value you want to protect in a relationship?'],['love-2','When do you feel most comfortable being yourself?'],['love-3','What is a small act of care that means a lot to you?'],['love-4','What does a healthy disagreement look like to you?'],['love-5','What kind of future memory would you like to make?'],['love-6','What do you need more of when life gets busy?'],['love-7','What does trust look like in everyday actions?'],['love-8','What is something you would like to understand better about me?'],['love-9','What is a boundary that helps you feel respected?'],['love-10','What makes you feel safe enough to be vulnerable?'],
  ] },
  { gameId: 'a-or-b', packId: 'pack-a-or-b-couples-v1', packName: 'This or That', description: 'Preference pairs for partner-guessing rounds.', kind: 'party-prompt', categoryId: 'choices', entries: [
    ['ab-1','Beach holiday || Mountain getaway'],['ab-2','Sunrise || Sunset'],['ab-3','Plan everything || Be spontaneous'],['ab-4','Cook together || Eat out'],['ab-5','City break || Nature retreat'],['ab-6','Books || Podcasts'],['ab-7','Quiet evening || Big gathering'],['ab-8','Coffee || Tea'],['ab-9','Road trip || Train journey'],['ab-10','Try something new || Perfect a favourite'],
  ] },
  { gameId: 'reverse-singing', packId: 'pack-reverse-singing-starters-v1', packName: 'Sing It Back', description: 'A prompt deck for short, user-recorded singing rounds.', kind: 'party-prompt', categoryId: 'singing', entries: [['sing-1','Record a short line from a song everyone knows.'],['sing-2','Choose a chorus line and sing it clearly.'],['sing-3','Pick a familiar melody and record one short phrase.']] },
]


// Explicitly adult-tagged source content is kept separate from every all-ages pool.
// These are suggestive / sexual-topic references, not graphic sexual instructions.
const ADULT_DEFINITIONS: readonly SeedDefinition[] = [
  { gameId: 'imposter', packId: 'pack-imposter-after-dark-v1', packName: 'After Dark · Vocabulary', description: 'Adult-topic vocabulary for groups who have explicitly enabled 18+ mode.', kind: 'word', categoryId: 'adult-vocabulary', suitability: 'adult', entries: [
    ['adult-word-bdsm', 'BDSM', 'A consensual adult power-exchange umbrella term'],
    ['adult-word-hentai', 'Hentai', 'A Japanese animation and comics genre'],
    ['adult-word-penis', 'Penis', 'An anatomical term'],
    ['adult-word-vagina', 'Vagina', 'An anatomical term'],
    ['adult-word-condom', 'Condom', 'A barrier used in safer sex'],
    ['adult-word-orgasm', 'Orgasm', 'A sexual-response term'],
    ['adult-word-fetish', 'Fetish', 'A specific source of adult attraction'],
    ['adult-word-sexting', 'Sexting', 'Sending intimate messages by phone'],
    ['adult-word-virginity', 'Virginity', 'A cultural concept about sexual experience'],
    ['adult-word-lingerie', 'Lingerie', 'Intimate apparel'],
  ] },
  { gameId: 'guessup', packId: 'pack-guessup-after-dark-v1', packName: 'After Dark · Charades', description: 'Adult-leaning but non-graphic party acting prompts.', kind: 'phrase', categoryId: 'after-dark-scenes', suitability: 'adult', entries: [
    ['adult-guess-1', 'Trying to act normal after an awkward flirt'],
    ['adult-guess-2', 'Sending a risky text and instantly regretting it'],
    ['adult-guess-3', 'Giving a dramatic soap-opera kiss to your own hand'],
    ['adult-guess-4', 'Getting caught sneaking one last snack at midnight'],
    ['adult-guess-5', 'Trying to explain a very questionable search history'],
    ['adult-guess-6', 'Flirting so badly that the room goes silent'],
    ['adult-guess-7', 'Reacting to an unexpectedly spicy group-chat message'],
    ['adult-guess-8', 'Delivering a villain monologue about your ex'],
  ] },
  { gameId: 'truth-or-dare', packId: 'pack-truth-after-dark-v1', packName: 'After Dark · Truths', description: 'Adult relationship and sexual-history questions. Anyone may pass without explanation.', kind: 'truth', categoryId: 'truth', suitability: 'adult', entries: [
    ['adult-truth-1', 'How did you lose your virginity, if you are comfortable sharing? You may pass or answer fictionally.'],
    ['adult-truth-2', 'What is the boldest flirt you have ever tried?'],
    ['adult-truth-3', 'What is a sexual-health topic you wish people discussed more openly?'],
    ['adult-truth-4', 'What is one boundary that makes intimacy feel safer for you?'],
    ['adult-truth-5', 'Have you ever had a crush on someone in this room? You can pass.'],
    ['adult-truth-6', 'What is the most awkward date you have been on?'],
    ['adult-truth-7', 'What is a harmless adult misconception you once believed?'],
    ['adult-truth-8', 'What is a green flag that makes someone instantly more attractive?'],
    ['adult-truth-9', 'What is the funniest double meaning you have misunderstood?'],
    ['adult-truth-10', 'What is a romantic or intimate question you would rather be asked privately?'],
  ] },
  { gameId: 'truth-or-dare', packId: 'pack-dare-after-dark-v1', packName: 'After Dark · Dares', description: 'Naughty, theatrical dares with consent, alternatives and a no-pressure pass.', kind: 'dare', categoryId: 'dare', suitability: 'adult', entries: [
    ['adult-dare-1', 'Ask the person next to you whether they would like a brief kiss on the lips. Only proceed after a clear yes; otherwise do a theatrical air-kiss.'],
    ['adult-dare-2', 'Perform a dramatic fictional character announcement: “I am gay!” You may choose another line or pass; never assign an identity to anyone.'],
    ['adult-dare-3', 'Read your last harmless text in the voice of a scandalous soap-opera villain, or invent one.'],
    ['adult-dare-4', 'Give a 20-second presentation defending the most ridiculous dating red flag.'],
    ['adult-dare-5', 'Deliver your best over-the-top pickup line to an empty chair.'],
    ['adult-dare-6', 'Act out discovering that your fictional secret admirer is a houseplant.'],
    ['adult-dare-7', 'Let the group choose a silly, non-identifying nickname for your next turn, or choose your own.'],
    ['adult-dare-8', 'Perform a dramatic air-kiss to the ceiling like the lead in a melodrama.'],
    ['adult-dare-9', 'Give a mock warning label for dating you. Keep it playful, not personal.'],
    ['adult-dare-10', 'Whisper a completely fictional, PG-13 scandalous confession to an imaginary microphone.'],
  ] },
  { gameId: 'never-have-i-ever', packId: 'pack-never-after-dark-v1', packName: 'After Dark · Confessions', description: 'Adult dating, flirting and relationship statements. Passing is always allowed.', kind: 'never-have-i-ever', categoryId: 'after-dark', suitability: 'adult', entries: [
    ['adult-nhi-1', 'I have never sent a flirty message and immediately wished I could unsend it.'],
    ['adult-nhi-2', 'I have never gone on a date mainly for the story.'],
    ['adult-nhi-3', 'I have never had a crush on a friend.'],
    ['adult-nhi-4', 'I have never lied about liking a date to avoid awkwardness.'],
    ['adult-nhi-5', 'I have never searched a dating match online before meeting them.'],
    ['adult-nhi-6', 'I have never had a romantic moment interrupted at the worst possible time.'],
    ['adult-nhi-7', 'I have never used a dating-app opening line that failed spectacularly.'],
    ['adult-nhi-8', 'I have never discussed a sexual boundary before a date.'],
    ['adult-nhi-9', 'I have never pretended not to notice someone flirting with me.'],
    ['adult-nhi-10', 'I have never had an ex send a message at exactly the wrong time.'],
  ] },
]

const packs = new Map<string, ContentPack>()
const content: ContentItem[] = []

for (const definition of [...DEFINITIONS, ...ARCADE_DEFINITIONS, ...ADULT_DEFINITIONS]) {
  const suitability = definition.suitability ?? DEFAULT_SUITABILITY;
  const packId = asPackId(definition.packId)
  const existingPack = packs.get(definition.packId)
  const contentIds = definition.entries.map(([id]) => asContentId(id))

  for (const [id, text, hint] of definition.entries) {
    content.push(parseContentItem({
      id: asContentId(id),
      gameId: definition.gameId,
      kind: definition.kind,
      text,
      ...(hint ? { hints: [hint] } : {}),
      locale: 'en',
      packId,
      categoryId: definition.categoryId,
      suitability,
      tags: [definition.gameId, definition.categoryId],
      provenance: {
        source: SOURCE,
        license: LICENSE,
        creator: CREATOR,
        createdAt: CREATED_AT,
        reviewedAt: null,
      },
    }))
  }

  if (existingPack) {
    packs.set(definition.packId, parseContentPack({
      ...existingPack,
      contentIds: [...existingPack.contentIds, ...contentIds],
    }))
  } else {
    packs.set(definition.packId, parseContentPack({
      id: packId,
      gameId: definition.gameId,
      name: definition.packName,
      description: definition.description,
      locale: 'en',
      suitability,
      version: 1,
      contentIds,
      isDefault: true,
    }))
  }
}

for (const category of IMPOSTER_CATEGORY_BANKS) {
  const packIdText = `pack-imposter-${category.id}-v1`
  const packId = asPackId(packIdText)
  const ids = category.words.map((_, index) => asContentId(`imp-${category.id}-${index + 1}`))
  category.words.forEach((text, index) => content.push(parseContentItem({
    id: ids[index], gameId: 'imposter', kind: 'word', text, locale: 'en', packId,
    categoryId: category.id, suitability: DEFAULT_SUITABILITY,
    tags: ['imposter', category.id], hints: getSeededImposterHints(text, category.name),
    provenance: { source: SOURCE, license: LICENSE, creator: CREATOR, createdAt: CREATED_AT, reviewedAt: null },
  })))
  packs.set(packIdText, parseContentPack({ id: packId, gameId: 'imposter', name: category.name, description: category.description, locale: 'en', suitability: DEFAULT_SUITABILITY, version: 1, contentIds: ids, isDefault: true }))
}

export const SEEDED_CONTENT: readonly ContentItem[] = Object.freeze(content)
export const SEEDED_PACKS: readonly ContentPack[] = Object.freeze([...packs.values()])

export function getSeededPackContent(packId: string): readonly ContentItem[] {
  const pack = packs.get(packId)
  if (!pack) return []
  const eligibleIds = new Set(pack.contentIds)
  return SEEDED_CONTENT.filter((item) => eligibleIds.has(item.id))
}
