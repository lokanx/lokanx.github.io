---
title: "Using react-query for all kind of async logic"
date: 2023-06-19T22:00:00+0200
last_modified_at: 2023-06-19T22:00:00+02:00
layout: single
lang: en
categories:
   - frontend
tags:
   - typescript
   - frontend
   - react
   - react-query
toc: false
author_profile: true
classes: wide
---

Using [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) for REST calls performed by [axios](https://www.npmjs.com/package/axios) is a well known pattern. But you can use it for all kind of async logic. Here I will present how to use it with the browser speech synthesis API.

To make it easier to use the browser speech synthesis API I use the [easy-speech](https://www.npmjs.com/package/easy-speech) library that abstracts away some complexity and browser diffrences.

First thing we need to do is to put the easy-speech speak method into use. Read the easy-speech documentation for how to init and use since this is out of scope for this blog post.

SpeechService.ts

```typescript
import EasySpeech, { SpeechSynthesisVoice } from 'easy-speech';

export interface SpeakParams {
   text: string;
   voice: SpeechSynthesisVoice;
}

const speak = ({ text, voice }: SpeakParams): Promise<void> => {
   console.log('About to say:', text, ', using voice:', voice, 'of type', typeof voice);

   return new Promise<void>((resolve, reject) => {
      EasySpeech.speak({
         text: text,
         voice,
         pitch: 1,
         rate: 1,
         volume: 1,
         // there are more events, see the API for supported events
         //boundary: (e: any) => console.debug('boundary reached', e)
      })
         .then(() => {
            console.debug('Done saying:', text, ', using voice:', voice);
            resolve();
         })
         .catch((error: any) => {
            console.error('Failed saying:', text, ', using voice:', voice, error);
            reject(error);
         });
   });
};

...

const SpeechService = {
   speak,
   ...
};

export default SpeechService;

```

Now lets connect this async speak method with react-query

useSpeak.ts

```typescript
import { useMutation } from "@tanstack/react-query";
import SpeechService, { SpeakParams } from "../services/SpeechService";

interface UseSpeakParams {
   onSuccess?: () => void;
   onError?: (error: Error) => void;
}

const performSpeak = async (params: SpeakParams) => {
   try {
      return await SpeechService.speak(params);
   } catch (error: any) {
      throw error;
   }
};

export const useSpeak = ({
   onSuccess = () => {},
   onError = () => {},
}: UseSpeakParams) => {
   const mutator = useMutation(performSpeak, {
      onSuccess: () => {
         onSuccess();
      },
      onError: (error: Error) => {
         onError(error);
      },
      retry: false,
   });

   return [
      mutator.mutate,
      { isSaving: mutator.isLoading, ...mutator },
   ] as const;
};
```

And finally lets put the useSpeak hook into work in a react component.

SayHelloComponent.tsx

```typescript
import React from "react";
import { useSpeak } from "../hooks/useSpeak";
import { SpeechSynthesisVoice } from "easy-speech";
import Select, { SingleValue } from "react-select";
import { useVoices } from "../hooks/useVoices";
import { SpeechSynthesisVoiceData } from "../services/SpeechService";

export const SayHelloComponent = () => {
   const [text, setText] = React.useState<string>("Hi there! Are you ready?");
   const [voiceData, setVoiceData] = React.useState<
      SpeechSynthesisVoiceData | undefined
   >();
   const [availableVoices] = useVoices();

   const [speak] = useSpeak({
      onError: (error: Error) => {
         console.error("Failed speak:", error);
      },
   });

   const speech = () => {
      if (voiceData) {
         speak({ text, voice: voiceData.voice });
      }
   };

   return (
      <div style={{ margin: "20px", width: "200px" }}>
         <Select
            id="language"
            value={voiceData}
            options={availableVoices as any}
            onChange={(value: SingleValue<SpeechSynthesisVoiceData>) => {
               if (value && value.voice) {
                  setVoiceData(value);
               }
            }}
         />
         <input
            type="text"
            value={text}
            style={{
               marginRight: "10px",
               width: "192px",
               marginTop: "4px",
               marginBottom: "4px",
               height: "28px",
            }}
            onChange={(event) => {
               setText(event?.target?.value || "");
            }}
         ></input>
         <button
            style={{
               paddingLeft: "20px",
               paddingRight: "20px",
               paddingTop: "10px",
               paddingBottom: "10px",
            }}
            disabled={
               !voiceData || !availableVoices || availableVoices.length === 0
            }
            onClick={() => {
               speech();
            }}
         >
            Speak
         </button>
      </div>
   );
};

export default SayHelloComponent;
```

Source code this blog post is based on [could be found here](https://github.com/lokanx-playground/blog-react-query-example).
