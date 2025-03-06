import express from 'express';
import Alexa, { SkillBuilders } from 'ask-sdk-core';
import axios from 'axios'; // To make HTTP requests
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config()


const app = express();
app.use(cors());
app.use(bodyParser.json());
const PORT = 3000;

const GEMINI_API_KEY = 'AIzaSyBHjvHyJMrHOoHGPZxXcrPXauUfraB-Wr8'; 
const GEMINI_ENDPOINT = 'https://gemini.googleapis.com/v1/ask';

const MONGO_URI = process.env.MONGO_URI;

//  ✅ Mongoose Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({ userData: {} }, { timestamps: true });
const User = mongoose.model('User', userSchema);





// Helper function to call Gemini API


async function callGeminiApi(prompt, userData) {
    try { console.log(prompt,userData,"userData")
        // Function to find relevant info in the dataset
        function getPatientInfo(query) {
            if (typeof query === String) {
                query = query.toLowerCase();
            } else {
                query = query
            }
            const idQueries = ["my id", "my user id", "what is my id", "my patient id"];
            if (idQueries.some(idQuery => query.includes(idQuery))) {
                return `Your user ID is ${userData.patient_id}.`;
            }

            // Dynamic Check for Name
            const nameQueries = ["my name", "what is my name", "tell me my name"];
            if (nameQueries.some(nameQuery => query.includes(nameQuery))) {
                return `Your name is ${userData.name}.`;
            }

            // Dynamic Check for Age
            const ageQueries = ["my age", "how old am i", "tell me my age"];
            if (ageQueries.some(ageQuery => query.includes(ageQuery))) {
                return `You are ${userData.age} years old.`;
            }

            // Dynamic Check for Gender
            const genderQueries = ["my gender", "what is my gender"];
            if (genderQueries.some(genderQuery => query.includes(genderQuery))) {
                return `Your gender is ${userData.gender}.`;
            }
            const contactQueries = ["my contact", "my contact detail", "my contact details"];
            if (contactQueries.some(contactQuery => query.includes(contactQuery))) {
                return `Your contact details are ${JSON.stringify(userData.contact)}.`;
            }
            if (query.includes("my conditions")) return `You have ${userData.medical_history.chronic_conditions.join(", ")}.`;
            if (query.includes("my medications")) {
                return `You are taking: ${userData.current_medications.map(med => `${med.name} (${med.dosage}, ${med.frequency})`).join(", ")}.`;
            }
            if (query.includes("my doctor")) return `Your doctor is ${userData.next_appointment.doctor}.`;
            if (query.includes("my next appointment")) return `Your next appointment is on ${userData.next_appointment.date} at ${userData.next_appointment.time}.`;
            if (query.includes("my blood pressure")) return `Your blood pressure is ${JSON.stringify(userData.vitals)}.`;
            if (query.includes("my report")) return `Your report result is ${JSON.stringify(userData.lab_results)}.`;

            return null; // If data is not found
        }
      
        // Check if the information is in the dataset
        let responseText = getPatientInfo(prompt);

        if (responseText) {
            console.log("response Using dataset", responseText)
            return responseText; // Return the dataset answer if found
        } else {
            // If info is missing, ask the LLM
            console.log("Info not found in dataset. Sending query to Gemini...");

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    "contents": [{
                        "parts": [{ "text": prompt }]
                    }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            )
           // console.log("response.data.candidates?.[0]?.content.parts[0].text", response.data.candidates?.[0]?.content.parts[0].text)
            return response.data.candidates?.[0]?.content.parts[0].text || "I'm not sure how to respond.";
        }
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
        const { t } = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput = t('WELCOME');
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
        const userData1 = await User.findOne({}).sort({ createdAt: -1 }).lean();
        let geminiResponse = await callGeminiApi(userQuestion, userData1.userData)
       // let geminiResponse = await callGeminiApi(userQuestion);
        geminiResponse = String(geminiResponse).trim();
        return handlerInput.responseBuilder.speak(geminiResponse).getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const { t } = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput = t('HELP');
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const { t } = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput = t('GOODBYE');
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
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
    .addRequestHandlers(
        LaunchRequestHandler,
        AskQuestionIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
   

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, false, false);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});
// Define Routes
app.post('/api/v1/webhook-alexa', adapter.getRequestHandlers());

app.post('/api/user/data', async (req, res) => {
    if (!req.body.userData || req.body.userData == "" || req.body.userData == {} || req.body.userData == null || req.body.userData == "undefine") {
        res.json({ message: "Please provide correct body data set", code: 409 })
    } else {
        const userData = await User.create(req.body)
        res.json(userData)
    }
})
app.post('/api/user/test', async (req, res) => {
    if (!req.body.query || req.body.query == "" || req.body.query == {} || req.body.query == null || req.body.query == "undefine") {
        res.json({ message: "Please provide something in query ", code: 409 })
    } else {
        const userData1 = await User.findOne({}).sort({ createdAt: -1 }).lean();
        const values = await callGeminiApi(req.body.query, userData1.userData)
        res.json({ "value": values, message: "Success", Code: 200 })
    }
})
// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});





