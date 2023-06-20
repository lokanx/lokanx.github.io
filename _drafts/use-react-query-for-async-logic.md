---
title: "Using react-query for all kind of async logic"
date: 2023-06-19T18:39:00+0200
last_modified_at: 2023-06-19T18:30:00+02:00
layout: single
categories:
   - frontend
tags:
   - typescript
   - frontend
   - react
   - react-query
toc: false
---

Using [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) for REST calls performed by [axios](https://www.npmjs.com/package/axios) is a well known pattern. But you can use it for all kind of async logic. Here I will present how to use it with the browser speech synthesis API.

To make it easier to use the browser speech synthesis API I use the [easy-speech](https://www.npmjs.com/package/easy-speech) library that abstracts away some complexity and browser diffrences.

First thing we need to do is to put the easy-speech speak method into use. Read the easy-speech documentation for how to init and use since this is out of scope for this blog post.

SpeechService.ts

```typescript
import EasySpeech, { SpeechSynthesisVoice } from "easy-speech";

export interface SpeakParams {
   text: string;
   voice: SpeechSynthesisVoice;
}

const speak = ({ text, requestedVoice }: SpeakParams): Promise<void> => {
   console.log(
      "About to say:",
      text,
      ", using voice:",
      voice,
      "of type",
      typeof requestedVoice
   );

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
            Logger.debug("Done saying:", text, ", using voice:", voice);
            resolve();
         })
         .catch((error: any) => {
            Logger.error(
               "Failed saying:",
               text,
               ", using voice:",
               voice,
               error
            );
            reject(error);
         });
   });
};

const SpeechService = {
   getLanguageOptionVoices,
   speak,
};

export default SpeechService;
```

Now lets connect this async speak method with react-query

useSpeak.ts

```typescript
import { useMutation } from "@tanstack/react-query";
import SpeechService, { SpeakParams } from "./SpeechService";

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
import React from 'react';
import { useSpeak } from '../../hooks/useSpeak';
import { SpeechSynthesisVoice } from "easy-speech";


interface SayHelloComponentProps {
   availableVoices: SpeechSynthesisVoice[];
}

const SayHelloComponent = ({
   availableVoices,
}: SayHelloComponentProps) => {
   const [speak] = useSpeak({
      onError: (error: Error) => {
         console.error('Failed speak:', error);
      },
   });

   const speech = () => {
      Logger.info('Saying "', samplePhrase, '" as', selectedVoice?.label || '"John Doe"');
      speak({ text: samplePhrase, requestedVoice: selectedVoice?.voice });
   };


   return (
   <input
      type="text"
      defaultValue="Hi there! Are you ready?"
      style={{ width: '230px', marginRight: '10px' }}
   ></input>
   <button
      disabled={!speakEnabled}
      variant="primary"
      onClick={() => {
         speech();
      }}
   >
      Speak
   </bbutton>
   );
};
```
