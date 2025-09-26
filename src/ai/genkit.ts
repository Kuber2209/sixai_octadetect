import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {vertexAI} from '@genkit-ai/vertexai';

const oncodetectModel = {
  name: 'custom-oral-cancer-model',
  type: 'custom',
  model:
    'projects/oncodetect-ai/locations/us-central1/endpoints/5381831701358313472',
};

export const ai = genkit({
  plugins: [googleAI(), vertexAI({models: [oncodetectModel]})],
  model: 'googleai/gemini-2.5-flash',
});
