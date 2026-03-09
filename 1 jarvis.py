import os
import smtplib
import pyttsx3
import speech_recognition as sr
import datetime
import wikipedia
import webbrowser

engine = pyttsx3.init('sapi5')
voices = engine.getProperty('voices')
# print(voices[0].id)
engine.setProperty('voice', voices[0].id)




def speak(audio):
    engine.say(audio)
    engine.runAndWait()

def wishMe():
    hour = int(datetime.datetime.now().hour)
    if hour >= 0 and hour < 12:
        greet = "Good Morning!"
    elif hour >= 12 and hour < 18:
        greet = "Good Afternoon!"
    else:
        greet = "Good Evening!"
    speak(f"{greet} I am Jarvis Sir. Please tell me how may I help you?")
def takeCommand():
    #it takes micro phone from user and return output
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening....")
        # Add energy threshold adjustment
        r.energy_threshold = 4000
        r.dynamic_energy_threshold = True
        # Adjust pause threshold
        r.pause_threshold = 0.8
        # Add ambient noise adjustment
        r.adjust_for_ambient_noise(source, duration=1)
        audio = r.listen(source)
    
    try:
        print("Recognizing....")
        # Fix: 'Language' to 'language'
        query = r.recognize_google(audio, language='en-in')
        print(f"User said: {query}\n")
    except Exception as e:
        print("Say that again please......")
        return "None"
    return query


def sendEmail(to, content):
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.ehlo()
    server.starttls()
    server.login('your mail @gmail.com','Your-password')
    server.sendmail('your mail@gamil.com', to, content)
    server.close()
    
    
if __name__ == "__main__":
    wishMe()
    # if 1:
    while True :
        query= takeCommand().lower()

        if 'wikipedia' in query:
            speak("Searching Wikipedia....")
            query = query.replace("wikipedia","")
            results = wikipedia.summary(query, sentences=2)
            speak("According to Wikipedia")
            print(results)
            speak(results)
        
        elif 'open youtube' in query:
          webbrowser.open("youtube.com")   
        elif 'open google' in query:
            webbrowser.open("google.com")    
        elif 'open chatgpt' in query:
            webbrowser.open("chat.openai.com")
        elif 'time ' in query:
            datetime_str = datetime.datetime.now().strftime("%H:%M:%S")
            speak(f"Sir, the time is {datetime_str}")
        elif 'open code' in query:
            codepath="C:\\Users\\PC1\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe"   
            os.startfile(codepath)
        elif 'email to me ' in query:
            try:
                speak("What should I say?")
                content = takeCommand()
                to = "your mail @gamil.com"
                sendEmail(to, content)
                speak("Email has been sent!")
            except Exception as e:  
                speak("Sorry my friend. I am not able to send this email")
            