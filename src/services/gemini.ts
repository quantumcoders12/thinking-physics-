import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are an AI engine inside a web app called Thinking Physics. Your job is to turn a user’s text prompt into a high‑quality, visual, PhET‑style science experiment or activity.

Reference Style: Your output should aim for the depth, interactivity, and visual clarity of simulations like PhET's "Buoyancy Basics" (https://phet.colorado.edu/sims/html/buoyancy-basics/latest/buoyancy-basics_all.html).

CRITICAL REQUIREMENT: You MUST provide a fully functional, interactive p5.js simulation in the "simulationCode" field. This code will be executed in a sandbox.

Given a user prompt, you must:

1. Identify context
- Detect: subject (Physics/Chemistry/Biology/Earth Science), topic, subtopic, and approximate grade level.
- Infer the learner’s prior knowledge (beginner, intermediate, advanced) from the prompt.

2. Design a visual, simulation‑style experiment
- Create an activity that can be experienced as an on‑screen interactive experiment.
- Describe clearly: Scene layout, Controls, Visual feedback, and Measurable outputs.

3. Implement the Simulation (p5.js)
- In the "simulationCode" field, write a complete, self-contained p5.js sketch.
- The sketch MUST include:
  - A setup(p) function and a draw(p) function (where 'p' is the p5 instance).
  - Internal state management for all interactive elements.
  - Interactive UI elements (sliders, buttons) drawn directly on the canvas or handled via p5 mouse/keyboard events.
  - Physically accurate animations and real-time calculations.
  - Visual polish: use colors, labels, and smooth transitions to match the PhET aesthetic.
  - The canvas size should be responsive or fixed at 800x600.
  - IMPORTANT: The code should be a string that can be passed to 'new Function("p", code)'. It should look like:
    p.setup = function() { ... };
    p.draw = function() { ... };
    // ... other p5 methods like p.mousePressed, etc.

4. Output a structured experiment specification
Always respond in JSON with the exact structure provided in the response schema.

Quality requirements:
- Ensure the experiment is truly visual and interactive.
- Make sure controls, objects, and behaviors are physically correct.
- Avoid unsafe or unrealistic setups.
- Keep language student-friendly but scientifically accurate.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subject: { type: Type.STRING },
        topic: { type: Type.STRING },
        gradeLevel: { type: Type.STRING },
        estimatedDurationMinutes: { type: Type.NUMBER }
      },
      required: ["title", "subject", "topic", "gradeLevel", "estimatedDurationMinutes"]
    },
    visualSimulation: {
      type: Type.OBJECT,
      properties: {
        sceneDescription: { type: Type.STRING },
        simulationCode: { 
          type: Type.STRING, 
          description: "Complete p5.js sketch code using the instance mode (p.setup, p.draw, etc.)." 
        },
        objects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              properties: {
                type: Type.OBJECT,
                properties: {
                  initialValues: { type: Type.OBJECT },
                  units: { type: Type.OBJECT },
                  constraints: { type: Type.OBJECT }
                }
              }
            },
            required: ["id", "type", "properties"]
          }
        },
        controls: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              controlType: { type: Type.STRING },
              bindsToObjectId: { type: Type.STRING },
              bindsToProperty: { type: Type.STRING },
              range: { type: Type.OBJECT },
              effectDescription: { type: Type.STRING }
            },
            required: ["id", "label", "controlType", "effectDescription"]
          }
        },
        visualBehaviors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              when: { type: Type.STRING },
              then: { type: Type.STRING }
            },
            required: ["when", "then"]
          }
        },
        measurementDisplays: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              shows: { type: Type.STRING },
              updateRuleDescription: { type: Type.STRING }
            },
            required: ["type", "shows", "updateRuleDescription"]
          }
        }
      },
      required: ["sceneDescription", "simulationCode", "objects", "controls", "visualBehaviors", "measurementDisplays"]
    },
    labGuide: {
      type: Type.OBJECT,
      properties: {
        learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
        materials: { type: Type.ARRAY, items: { type: Type.STRING } },
        procedure: { type: Type.ARRAY, items: { type: Type.STRING } },
        safetyPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
        scienceExplanation: {
          type: Type.OBJECT,
          properties: {
            intuitiveOverview: { type: Type.STRING },
            formalExplanation: { type: Type.STRING },
            keyEquations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["intuitiveOverview", "formalExplanation", "keyEquations"]
        },
        checkYourUnderstanding: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctOptionIndex: { type: Type.NUMBER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctOptionIndex", "explanation"]
          }
        }
      },
      required: ["learningObjectives", "materials", "procedure", "safetyPrecautions", "scienceExplanation", "checkYourUnderstanding"]
    },
    phetAnalogy: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        recommendedPhETCategory: { type: Type.STRING }
      },
      required: ["description", "recommendedPhETCategory"]
    }
  },
  required: ["meta", "visualSimulation", "labGuide", "phetAnalogy"]
};

export type AIProvider = "gemini" | "openai";

export async function generateExperiment(
  prompt: string,
  customApiKey?: string,
  isQuantumMode: boolean = false,
  provider: AIProvider = "gemini"
) {
  if (provider === "openai") {
    return generateOpenAIExperiment(prompt, customApiKey, isQuantumMode);
  }

  // Prioritize explicit customApiKey, then user's personal API key (process.env.API_KEY), then GEMINI_API_KEY
  const apiKey = customApiKey?.trim() || process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("No API key configured. Please enter your Gemini API key in the settings or select a key.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const activeSystemInstruction = isQuantumMode
    ? SYSTEM_INSTRUCTION + `\n\nCRITICAL QUANTUM DARK MODE INSTRUCTION: The user is currently operating in Quantum Dark Mode. You MUST generate the p5.js canvas simulation code with a sleek, high-contrast dark mode aesthetic. Use dark canvas background colors (e.g. p.background('#090d16') or p.background('#060810')). Use vibrant glowing neon cyan (#00f0ff), electric magenta/purple (#d946ef), neon lime green (#00ff66), electric blue (#3b82f6), and crisp white (#ffffff) for particles, vectors, light rays, trajectory lines, labels, grid lines, and canvas UI controls so that the experiment looks stunning, dark-themed, and ultra-readable on a dark canvas.`
    : SYSTEM_INSTRUCTION;
  
  // Try primary model first, fallback to flash model if quota is exhausted or model is unavailable
  const modelsToTry = ["gemini-3.1-pro-preview", "gemini-3-flash-preview"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: activeSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error?.message || error);
      lastError = error;
      // If it's not a quota or model error, don't retry other models
      const isQuotaOrNotFound = 
        error?.message?.includes("RESOURCE_EXHAUSTED") || 
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.status === 429 ||
        error?.message?.includes("429") ||
        error?.message?.includes("not found");
      
      if (!isQuotaOrNotFound) {
        throw error;
      }
    }
  }

  // If all models failed with quota/resource exhausted
  if (
    lastError?.message?.includes("RESOURCE_EXHAUSTED") ||
    lastError?.status === "RESOURCE_EXHAUSTED" ||
    lastError?.status === 429 ||
    lastError?.message?.includes("429")
  ) {
    const quotaError = new Error("QUOTA_EXCEEDED");
    (quotaError as any).originalError = lastError;
    throw quotaError;
  }

  throw lastError || new Error("Failed to generate experiment.");
}

async function generateOpenAIExperiment(prompt: string, customApiKey?: string, isQuantumMode = false) {
  const apiKey = customApiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("No API key configured. Please enter your OpenAI API key in the settings.");
  }

  const activeSystemInstruction = isQuantumMode
    ? SYSTEM_INSTRUCTION + "\n\nThe user is in Quantum Dark Mode. Use a sleek dark p5.js canvas with bright, high-contrast neon colors."
    : SYSTEM_INSTRUCTION;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: activeSystemInstruction },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = error?.error?.message || `OpenAI request failed (${response.status}).`;
    if (response.status === 429) throw new Error("QUOTA_EXCEEDED");
    throw new Error(message);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return JSON.parse(content);
}
