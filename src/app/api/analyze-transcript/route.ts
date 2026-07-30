import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
      return NextResponse.json(
        { error: 'Groq API Key is missing. Please configure GROQ_API_KEY in your .env.local file.' },
        { status: 500 }
      );
    }

    const prompt = `You are creating Islamic YouTube Shorts.
Analyze the transcript.
Extract visual scenes.
Return English keywords and durations.

Rules:
* Return valid JSON only.
* Return a JSON object with a single key "scenes" which contains an array of objects.
* Each scene object must have "keyword" (string) and "duration" (integer, in seconds).
* Keywords must be visual.
* Use simple nouns.
* Maximum 2 words per keyword.
* Avoid abstract concepts.
* Focus on objects, places, people, and actions.
* Generate 5-10 scenes.
* Total duration of all scenes combined should ideally be between 15 to 45 seconds (5 seconds per scene is standard, but you can adjust duration dynamically).

Example output:
{
  "scenes": [
    { "keyword": "parents", "duration": 5 },
    { "keyword": "charity", "duration": 5 },
    { "keyword": "prayer", "duration": 5 },
    { "keyword": "mosque", "duration": 5 },
    { "keyword": "quran", "duration": 5 }
  ]
}

Transcript:
${transcript}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Empty response received from Groq API.');
    }

    const parsedData = JSON.parse(responseContent);

    if (!parsedData.scenes || !Array.isArray(parsedData.scenes)) {
      throw new Error('Groq did not return a valid list of "scenes".');
    }

    return NextResponse.json({ scenes: parsedData.scenes });
  } catch (error: unknown) {
    console.error('Error analyzing transcript:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
