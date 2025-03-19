require('dotenv').config({ path: __dirname + '/.env' });
console.log('Loaded .env file from:', __dirname + '/.env', 'TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN);
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set. Check your .env file or environment variables.');
  process.exit(1);
}

const { Telegraf } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const escape = require('markdown-escape');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const session = new LocalSession({ getSessionKey: (ctx) => ctx.from?.id?.toString() });
bot.use(session.middleware());

const models = {
  text: {
    'meta_llama': {
      displayName: '🦙 Meta Llama 3.1 8B',
      apiModelName: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.9
    }
  },
  image: {
    'flux': {
      displayName: '🎨 FLUX.1-dev',
      apiModelName: 'FLUX.1-dev'
    }
  }
};

function showCategorySelection(ctx) {
  ctx.reply('*📂 Choose a category:*', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍳 Recipes', callback_data: 'category_recipes' }],
        [{ text: '🖼️ Pictures', callback_data: 'category_pictures' }],
        [{ text: '🌍 Explore More', callback_data: 'category_explore' }]
      ]
    }
  });
}

function getRestartKeyboard() {
  return { inline_keyboard: [[{ text: '🔄 Restart', callback_data: 'restart' }]] };
}

async function generateText(apiKey, prompt, userId) {
  const url = "https://api.hyperbolic.xyz/v1/chat/completions";
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
  const data = {
    messages: [
      { role: "system", content: "You are a gourmet. Be descriptive and helpful." },
      { role: "user", content: prompt }
    ],
    model: models.text.meta_llama.apiModelName,
    max_tokens: models.text.meta_llama.maxTokens,
    temperature: models.text.meta_llama.temperature,
    top_p: models.text.meta_llama.topP
  };

  try {
    console.log(`Sending text generation request for user ${userId}: ${prompt.substring(0, 50)}...`);
    const response = await axios.post(url, data, { headers });
    const answer = response.data.choices[0].message.content;
    console.log(`Received full response for user ${userId}:`, answer);
    const escapedAnswer = escape(answer);
    return escapedAnswer;
  } catch (error) {
    console.error(`Error generating text for user ${userId}:`, error);
    throw new Error(error.response?.status === 401 ? '🔑 Invalid API Key' : '⚠️ Processing Error');
  }
}

async function generateImage(apiKey, prompt, userId, dish) {
  const url = "https://api.hyperbolic.xyz/v1/image/generation";
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
  const data = {
    model_name: models.image.flux.apiModelName,
    prompt,
    steps: 50,
    cfg_scale: 7,
    enable_refiner: false,
    height: 1024,
    width: 1024,
    backend: "auto"
  };

  try {
    console.log(`Sending image generation request for user ${userId}: ${prompt.substring(0, 50)}...`);
    const response = await axios.post(url, data, { headers });
    const imageData = response.data.images?.[0]?.image;
    if (!imageData) throw new Error("No image data received.");
    const imageBuffer = Buffer.from(imageData, 'base64');
    const imagePath = path.join(__dirname, 'images', `${dish.replace(/\s+/g, '_')}_${userId}.png`);
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, imageBuffer);
    return imagePath;
  } catch (error) {
    console.error(`Error generating image for user ${userId}:`, error);
    throw new Error(error.response?.status === 401 ? '🔑 Invalid API Key' : '⚠️ Processing Error');
  }
}

bot.command('start', (ctx) => {
  if (!ctx.session.apiKey) {
    ctx.reply(
      '*🌟 Welcome to Hyperbolic AI Bot! 🌟*\n\n' +
      'Get ready to explore a world of culinary delights! Send your Hyperbolic API Key to unlock features like:\n' +
      '- 🍳 Detailed recipes (standard, vegetarian, healthy, and quick)\n' +
      '- 🖼️ Stunning food images\n' +
      '- 🌍 Global cuisine insights (famous dishes, traditional recipes, and more)\n\n' +
      'To get started:\n' +
      '1. Visit [Hyperbolic Website](https://app.hyperbolic.xyz/) and log in\n' +
      '2. Go to the *Settings* section\n' +
      '3. Copy your API Key\n' +
      '4. Paste it here\n\n' +
      '🛡️ *Security Notice:*\n' +
      '- Your API key is stored securely\n' +
      '- Remove it anytime with /remove\n' +
      '- Key is only kept for session access',
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.reply('🔁 Restarting session...');
    showCategorySelection(ctx);
  }
});

bot.command('remove', (ctx) => {
  if (ctx.session.apiKey) {
    console.log(`Removing API key for user ${ctx.from.id}: ${ctx.session.apiKey}`);
    delete ctx.session.apiKey;
    delete ctx.session.context;
    ctx.reply('🗑️ *API key removed successfully!*', { parse_mode: 'Markdown' });
  } else {
    ctx.reply('ℹ️ *No API key set.*', { parse_mode: 'Markdown' });
  }
});

bot.command('recipe', async (ctx) => {
  if (!ctx.session.apiKey) return ctx.reply('🔐 *Please send your API key first!*', { parse_mode: 'Markdown' });
  const dish = ctx.message.text.split(' ').slice(1).join(' ');
  if (!dish) {
    ctx.reply('*🍳 Choose a recipe type:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📜 Standard Recipe', callback_data: 'recipe_standard' }],
          [{ text: '🌱 Vegetarian Recipe', callback_data: 'recipe_vegetarian' }],
          [{ text: '⏩ Quick Meal', callback_data: 'recipe_quick' }],
          [{ text: '🥗 Healthy Recipe', callback_data: 'recipe_healthy' }],
          [{ text: '🔄 Restart', callback_data: 'restart' }]
        ]
      }
    });
    return;
  }
  const prompt = `Tell me about ${dish} and provide a detailed recipe, including ingredients and step-by-step instructions.`;
  try {
    await ctx.sendChatAction('typing');
    const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
    const maxLength = 4000;
    const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
    await ctx.reply(`*🍳 Recipe for ${dish}:*\n${truncatedResponse}`, {
      parse_mode: 'Markdown',
      reply_markup: getRestartKeyboard()
    });
  } catch (error) {
    await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
  }
});

bot.command('picture', async (ctx) => {
  if (!ctx.session.apiKey) return ctx.reply('🔐 *Please send your API key first!*', { parse_mode: 'Markdown' });
  const dish = ctx.message.text.split(' ').slice(1).join(' ');
  if (!dish) return ctx.reply('*🖼️ Please provide a dish for the picture.*\nExample: /picture Sushi', { parse_mode: 'Markdown' });
  const prompt = `A high-quality, photorealistic image of ${dish}, beautifully plated on a white ceramic plate, with vibrant colors, soft natural lighting, and a clean wooden table background.`;
  try {
    await ctx.sendChatAction('upload_photo');
    const imagePath = await generateImage(ctx.session.apiKey, prompt, ctx.from.id, dish);
    await ctx.replyWithPhoto({ source: imagePath }, { caption: `*🖼️ Image of ${dish}*`, parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
  } catch (error) {
    await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
  }
});

bot.on('text', async (ctx) => {
  if (!ctx.session.apiKey) {
    ctx.session.apiKey = ctx.message.text;
    console.log(`API key set for user ${ctx.from.id}: ${ctx.session.apiKey}`);
    ctx.reply('✅ *API key saved!*', { parse_mode: 'Markdown' });
    showCategorySelection(ctx);
    return;
  }
  const currentContext = ctx.session.context;
  if (!currentContext) return ctx.reply('⚠️ *Select an action first!*', { parse_mode: 'Markdown' });
  const text = ctx.message.text;

  if (currentContext === 'pictures') {
    const prompt = text.toLowerCase().includes('food')
      ? `A high-quality, photorealistic image of ${text}, beautifully plated on a white ceramic plate, with vibrant colors, soft natural lighting, and a clean wooden table background.`
      : `A high-quality, photorealistic image of ${text}`;
    try {
      await ctx.sendChatAction('upload_photo');
      const imagePath = await generateImage(ctx.session.apiKey, prompt, ctx.from.id, text);
      await ctx.replyWithPhoto({ source: imagePath }, { caption: `*🖼️ Image of ${text}*`, parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'recipe_standard') {
    const prompt = `Tell me about ${text} and provide a detailed recipe, including ingredients and step-by-step instructions.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🍳 Recipe for ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'recipe_vegetarian') {
    const prompt = `Provide a vegetarian recipe for ${text}, including ingredients and step-by-step instructions.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🌱 Vegetarian Recipe for ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'recipe_healthy') {
    const prompt = `Provide a healthier version of ${text}, including ingredients and step-by-step instructions.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🥗 Healthy Recipe for ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_famousfoods') {
    const prompt = `List famous dishes from ${text}.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🇺🇳 Famous Dishes from ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_traditionalfood') {
    const prompt = `Provide a traditional dish from ${text} with a brief description.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🍲 Traditional Dish from ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_spicyfood') {
    const prompt = `List spicy dishes from ${text}.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🌶️ Spicy Dishes from ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_dessertrecipe') {
    const prompt = `Provide a dessert recipe from ${text}, including ingredients and step-by-step instructions.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🍰 Dessert Recipe from ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_streetfood') {
    const prompt = `List popular street foods from ${text}.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🚚 Popular Street Foods from ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  } else if (currentContext === 'explore_foodpairing') {
    const prompt = `Suggest a drink or side dish that pairs well with ${text}.`;
    try {
      await ctx.sendChatAction('typing');
      const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
      const maxLength = 4000;
      const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
      await ctx.reply(`*🍷 Food Pairing for ${text}:*\n${truncatedResponse}`, {
        parse_mode: 'Markdown',
        reply_markup: getRestartKeyboard()
      });
      ctx.session.context = null;
    } catch (error) {
      await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
    }
  }
});

bot.on('callback_query', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;

    if (data === 'restart') {
      ctx.session.context = null;
      await ctx.reply('*🔁 Restarting session...*', { parse_mode: 'Markdown' });
      showCategorySelection(ctx);
      return;
    }

    if (data === 'category_recipes') {
      ctx.session.context = 'recipes';
      await ctx.reply('*🍳 Choose a recipe type:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📜 Standard Recipe', callback_data: 'recipe_standard' }],
            [{ text: '🌱 Vegetarian Recipe', callback_data: 'recipe_vegetarian' }],
            [{ text: '⏩ Quick Meal', callback_data: 'recipe_quick' }],
            [{ text: '🥗 Healthy Recipe', callback_data: 'recipe_healthy' }],
            [{ text: '🔄 Restart', callback_data: 'restart' }]
          ]
        }
      });
    } else if (data === 'category_pictures') {
      ctx.session.context = 'pictures';
      await ctx.reply('*🖼️ Enter what you’d like to see (e.g., coffee, mountain):*', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'category_explore') {
      ctx.session.context = 'explore';
      await ctx.reply('*🌍 Explore more options:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇺🇳 Famous Foods by Country', callback_data: 'explore_famousfoods' }],
            [{ text: '🍲 Traditional Food by Country', callback_data: 'explore_traditionalfood' }],
            [{ text: '🎲 Random Dish', callback_data: 'explore_randomdish' }],
            [{ text: '🌶️ Spicy Foods by Country', callback_data: 'explore_spicyfood' }],
            [{ text: '🍰 Dessert Recipe by Country', callback_data: 'explore_dessertrecipe' }],
            [{ text: '🚚 Street Food by Country', callback_data: 'explore_streetfood' }],
            [{ text: '🍷 Food Pairing', callback_data: 'explore_foodpairing' }],
            [{ text: '🔄 Restart', callback_data: 'restart' }]
          ]
        }
      });
    } else if (data === 'recipe_standard') {
      ctx.session.context = 'recipe_standard';
      await ctx.reply('*📜 Enter the dish name for a standard recipe.*\nExample: Chicken Curry', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'recipe_vegetarian') {
      ctx.session.context = 'recipe_vegetarian';
      await ctx.reply('*🌱 Enter the dish name for a vegetarian recipe.*\nExample: Lasagna', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'recipe_quick') {
      const prompt = "Suggest a quick and easy meal recipe that can be prepared in under 30 minutes, including ingredients and step-by-step instructions.";
      try {
        await ctx.sendChatAction('typing');
        const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
        const maxLength = 4000;
        const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
        await ctx.reply(`*⏩ Quick Meal Suggestion:*\n${truncatedResponse}`, {
          parse_mode: 'Markdown',
          reply_markup: getRestartKeyboard()
        });
      } catch (error) {
        await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
      }
    } else if (data === 'recipe_healthy') {
      ctx.session.context = 'recipe_healthy';
      await ctx.reply('*🥗 Enter the dish name for a healthy recipe.*\nExample: Pizza', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_famousfoods') {
      ctx.session.context = 'explore_famousfoods';
      await ctx.reply('*🇺🇳 Enter the country to list famous foods.*\nExample: Italy', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_traditionalfood') {
      ctx.session.context = 'explore_traditionalfood';
      await ctx.reply('*🍲 Enter the country to get a traditional dish.*\nExample: Japan', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_randomdish') {
      const prompt = "Suggest a random dish from around the world, including its name, country of origin, and a short description.";
      try {
        await ctx.sendChatAction('typing');
        const response = await generateText(ctx.session.apiKey, prompt, ctx.from.id);
        const maxLength = 4000;
        const truncatedResponse = response.length > maxLength ? response.substring(0, maxLength) + '...' : response;
        await ctx.reply(`*🎲 Random Dish Suggestion:*\n${truncatedResponse}`, {
          parse_mode: 'Markdown',
          reply_markup: getRestartKeyboard()
        });
      } catch (error) {
        await ctx.reply(`❌ ${error.message}`, { parse_mode: 'Markdown' });
      }
    } else if (data === 'explore_spicyfood') {
      ctx.session.context = 'explore_spicyfood';
      await ctx.reply('*🌶️ Enter the country to list spicy foods.*\nExample: Thailand', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_dessertrecipe') {
      ctx.session.context = 'explore_dessertrecipe';
      await ctx.reply('*🍰 Enter the country for a dessert recipe.*\nExample: France', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_streetfood') {
      ctx.session.context = 'explore_streetfood';
      await ctx.reply('*🚚 Enter the country to list street foods.*\nExample: India', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    } else if (data === 'explore_foodpairing') {
      ctx.session.context = 'explore_foodpairing';
      await ctx.reply('*🍷 Enter the dish for a food pairing suggestion.*\nExample: Sushi', { parse_mode: 'Markdown', reply_markup: getRestartKeyboard() });
    }
  } catch (error) {
    console.error('Callback Error:', error);
    await ctx.reply('❌ Action failed', { parse_mode: 'Markdown' });
  }
});

bot.launch();
console.log('🤖 Bot running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
