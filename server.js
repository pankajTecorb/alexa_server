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
// app.use(bodyParser.json());
const PORT = 3000;

const GEMINI_API_KEY = "AIzaSyBHjvHyJMrHOoHGPZxXcrPXauUfraB-Wr8";

const MONGO_URI = "mongodb+srv://tecorb:U1mmSuwFNPZEHNlw@tecorb.juv3dbp.mongodb.net/alexa-skill?retryWrites=true&w=majority";

//  ✅ Mongoose Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({ userData: {} }, { timestamps: true });
const User = mongoose.model('User', userSchema);



// Helper function to call Gemini API


async function callGeminiApi(prompt, userData) {
    try { 
        // Function to find relevant info in the dataset
        function getPatientInfo(query) {
            if (typeof query === String) {
                query = query.toLowerCase();
            } else {
                query = query
            }
            const idQueries = ["my id", "my userid", "what is my id", "my patientid"];
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
                // return `Your contact details are ${JSON.stringify(userData.contact)}.`;
                return `Your Email is ${userData.contact.email} Phone Number: ${userData.contact.phone} and Address : ${userData.contact.address}.`;
            }
            if (query.includes("my conditions")) return `You have ${userData.medical_history.chronic_conditions.join(", ")}.`;
            if (query.includes("my medications")) {
                return `You are taking: ${userData.current_medications.map(med => `${med.name} (${med.dosage}, ${med.frequency})`).join(", ")}.`;
            }
            if (query.includes("my doctor")) return `Your doctor is ${userData.next_appointment.doctor}.`;  
          
            if (query.includes("my last visit")) return `Your last visit with doctor was ${userData.last_visit}.`; 
            if (query.includes("my next appointment")) return `Your next appointment is on ${userData.next_appointment.date} at ${userData.next_appointment.time} with ${userData.next_appointment.doctor}  , Doctor's phone number: ${userData.next_appointment.doctor_phone_number} , Location:${userData.next_appointment.location}.`;
            if (query.includes("my blood pressure")) return `Your blood pressure is ${userData.vitals.blood_pressure.systolic} and ${userData.vitals.blood_pressure.diastolic} ,
           Heart ate:${userData.vitals.heart_rate} , Temperature:${userData.vitals.temperature}  , Oxygen saturation:${userData.vitals.oxygen_saturation}.`;
            if (query.includes("my test report")) return `Your report details are :Glocose level ${userData.lab_results.blood_test.glucose_level.value} ${userData.lab_results.blood_test.glucose_level.unit} Status:${userData.lab_results.blood_test.glucose_level.status} .
           Cholesterol  Total: ${userData.lab_results.blood_test.cholesterol.total} , hdl: ${userData.lab_results.blood_test.cholesterol.hdl},ldl: ${userData.lab_results.blood_test.cholesterol.ldl},triglycerides: ${userData.lab_results.blood_test.cholesterol.triglycerides}
           Urine Test Protein ${userData.lab_results.urine_test.protein} ,Glucose:${userData.lab_results.urine_test.glucose},Ketones:${userData.lab_results.urine_test.ketones}`;

           if (query.includes("my recommendation")) return `Your  doctor recommendations are 1)Diet: ${userData.recommendations.diet} 2)Exercise: ${userData.recommendations.exercise} 3)Follow up: ${userData.recommendations.follow_up}.`; 
           if (query.includes("my medical history")) {
            const medicalHistory = userData.medical_history;
        
            const chronicConditions = medicalHistory.chronic_conditions?.join(", ") || "None";
            const allergies = medicalHistory.allergies?.join(", ") || "None";
        
            const pastSurgeries = medicalHistory.past_surgeries?.length > 0 
                ? medicalHistory.past_surgeries.map(surgery => `${surgery.surgery} (Year: ${surgery.year})`).join(", ")
                : "No past surgeries";
        
            const familyHistory = [];
            if (medicalHistory.family_history?.heart_disease) familyHistory.push("Heart Disease");
            if (medicalHistory.family_history?.diabetes) familyHistory.push("Diabetes");
            if (medicalHistory.family_history?.cancer) familyHistory.push("Cancer");
            
            const formattedFamilyHistory = familyHistory.length > 0 ? familyHistory.join(", ") : "No significant family history";
        
            return `Your medical history includes:
            - Chronic Conditions: ${chronicConditions}.
            - Allergies: ${allergies}.
            - Past Surgeries: ${pastSurgeries}.
            - Family History: ${formattedFamilyHistory}.`;
        }
        
           return null; // If data is not found
        }
        console.log("prompts input", prompt)
        // Check if the information is in the dataset
        let responseText = await getPatientInfo(prompt);

        if (responseText) {
             // Return Alexa-friendly response
              return  responseText 
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
            return response.data.candidates?.[0]?.content.parts[0].text || "I'm not sure how to respond.";
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error.response?.data || error.message);
        return "Sorry, I couldn't process your request.";
    }
}


/**
 * 1. LaunchRequestHandler - Handles skill launch.
 */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
       return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome! I am voice assistant from tecorb technologies and working on development environment please ask me selected questions thanks';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Can you say that again?')
            .getResponse();
    }
};


/**
 * 3. FallbackIntentHandler - Handles unexpected inputs.
 */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log('FallbackIntent triggered: User request not understood.');
        const speakOutput = 'I\'m sorry, I didn\'t understand that. Can you say it differently i am on development environment please ask me selected questions thanks?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Can you please rephrase?')
            .getResponse();
    }
};

/**
 * 4. ErrorHandler - Catches all errors and logs them.
 */
const ErrorHandler = {
    canHandle() {
        return true;  // This will catch any error
    },
    handle(handlerInput, error) {
        console.error(`Error occurred: ${error.message}`);
        const speakOutput = 'Sorry, something went wrong. Please try again.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Can you say that again?')
            .getResponse();
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
        
        let geminiResponse = await callGeminiApi(userQuestion, userData1.userData);
        geminiResponse = String(geminiResponse).trim();

        return handlerInput.responseBuilder
            .speak(geminiResponse)  // Speak response
            .reprompt("Would you like to ask anything else?") // ✅ Keeps session open
            .getResponse();
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
app.use(bodyParser.json());

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



