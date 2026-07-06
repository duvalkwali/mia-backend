import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GENERIC_AVOID_PHRASES = [
  {
    key: 'happy_to_help',
    phrase: "I'd be happy to help",
    variants: ["Happy to help", "I'm happy to assist", "I would be happy to help"],
  },
  {
    key: 'thank_you_reaching_out',
    phrase: 'Thank you for reaching out',
    variants: ['Thanks for contacting us', 'Thank you for getting in touch'],
  },
  {
    key: 'as_an_ai',
    phrase: 'As an AI',
    variants: ['As an AI language model', 'As your AI assistant', 'As an artificial intelligence'],
  },
  {
    key: 'great_question',
    phrase: 'Great question!',
    variants: ["That's a great question", 'What a great question', 'Excellent question'],
  },
  {
    key: 'certainly',
    phrase: 'Certainly!',
    variants: ['Absolutely!', 'Of course!', 'Certainly, I can help with that'],
  },
  {
    key: 'understand_concern',
    phrase: 'I understand your concern',
    variants: ['I understand your frustration', 'I completely understand', 'I understand how you feel'],
  },
  {
    key: 'hope_this_helps',
    phrase: 'I hope this helps',
    variants: ['Hope this helps!', 'I hope that helps', 'I hope this information is helpful'],
  },
  {
    key: 'please_dont_hesitate',
    phrase: "Please don't hesitate to reach out",
    variants: ["Don't hesitate to contact us", 'Feel free to reach out anytime'],
  },
  {
    key: 'valued_customer',
    phrase: 'valued customer',
    variants: ['our valued client', 'esteemed customer'],
  },
  {
    key: 'at_your_earliest_convenience',
    phrase: 'at your earliest convenience',
    variants: ['when convenient for you', 'at a time that suits you'],
  },
  {
    key: 'feel_free',
    phrase: 'Feel free to',
    variants: ['Please feel free to', 'You are welcome to'],
  },
  {
    key: 'kindly_note',
    phrase: 'Kindly note that',
    variants: ['Please note that', 'Kindly be advised'],
  },
  {
    key: 'appreciate_your_patience',
    phrase: 'I appreciate your patience',
    variants: ['Thank you for your patience', 'We appreciate your patience'],
  },
  {
    key: 'happy_to_clarify',
    phrase: 'Happy to clarify',
    variants: ['I am happy to clarify', 'Let me clarify'],
  },
  {
    key: 'rest_assured',
    phrase: 'Rest assured',
    variants: ['You can rest assured', 'Be assured that'],
  },
];

async function main() {
  console.log('Seeding generic avoid phrases...');

  for (const entry of GENERIC_AVOID_PHRASES) {
    await prisma.genericAvoidPhrase.upsert({
      where: { key: entry.key },
      update: { phrase: entry.phrase, variants: entry.variants },
      create: entry,
    });
  }

  console.log(`Seeded ${GENERIC_AVOID_PHRASES.length} generic avoid phrases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
