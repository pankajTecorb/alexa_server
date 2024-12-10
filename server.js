import express from 'express';
import Alexa, { SkillBuilders } from 'ask-sdk-core';
import axios from 'axios'; // To make HTTP requests
import { ExpressAdapter } from 'ask-sdk-express-adapter';

const app = express();
const PORT = 3000;

const GEMINI_API_KEY = 'AIzaSyBHjvHyJMrHOoHGPZxXcrPXauUfraB-Wr8'; // Use environment variables in production
const GEMINI_ENDPOINT = 'https://gemini.googleapis.com/v1/ask';

// Helper function to call Gemini API
async function callGeminiApi(prompt) {
    try {
        const response = await axios.post(
            GEMINI_ENDPOINT,
            { prompt }, // Request payload
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GEMINI_API_KEY}`
                }
            }
        );
        return response.data.answer || "I'm not sure how to respond.";
    } catch (error) {
        console.error('Error calling Gemini API:', error.response?.data || error.message);
        return "Sorry, I couldn't process your request.";
    }
}

// Alexa Skill Handlers
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hi I am Abhishek . You can ask me anything!';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

const AskQuestionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskQuestionIntent';
    },

    async handle(handlerInput) {
        const userQuestion = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question') || 'No question provided';
        const geminiResponse = await callGeminiApi(userQuestion);
        return handlerInput.responseBuilder.speak(geminiResponse).getResponse();
    }
};
const NameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NameIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'My Name is Abhishek from tecorb technologies and working on development mode please ask me selected questions thanks';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        const speakOutput = 'Sorry, I had trouble understanding your request. Please try again.';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

// Build the Alexa Skill
const skillBuilder = SkillBuilders.custom()
    .addRequestHandlers(LaunchRequestHandler, AskQuestionIntentHandler, NameIntentHandler)
    .addErrorHandlers(ErrorHandler);

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, false, false);

// Define Routes
app.post('/api/v1/webhook-alexa', adapter.getRequestHandlers());

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

