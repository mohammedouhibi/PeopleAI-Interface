import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';

type Handler = (t: any) => void;


interface ServerToClientEvents {
  noArg: () => void;
  withAck: (d: string, callback: (e: number) => void) => void;
  rasa_uttered: (data: any) => void;
  llm_uttered: (data: any) => void;
  diffusion_ended: (data: any) => void;
  registered: (data: string) => void;
}

interface ClientToServerEvents {
  hello: () => void;
  user_uttered: (data: any) => void;
  handle_reconnect: (data: any) => void;
  registration: () => void;

}



@Injectable({
  providedIn: 'root'
})
export class ChatbotService implements OnDestroy {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  sessionHash: string = null;
  sessionDisconnectFlag = false;
  constructor() {
  }

  setupSocketConnection(
    token: string,
    serverURL: string,
    rasaCallback: Handler,
    llmCallback: Handler,
    diffusionEndCallback: Handler
  ) {
    try {

      const options = {
        //transport set to polling
        transports: ['polling'],
        transportOptions: {
          polling: {
            extraHeaders: {
              Authorization: token
            }
          }
        }
      };
     if (token && token.trim() !== '')
      this.socket = io(serverURL, options);
      else
      this.socket = io(serverURL);
      this.socket.on("connect", () => {
        console.log("connected");
        if (this.sessionDisconnectFlag && this.sessionHash) {
          console.log("reconnecting")
          this.socket.emit('handle_reconnect', { hash: this.sessionHash });
        }
        else {
          console.log("registering")
          this.socket.emit('registration');
        }
      });

      this.socket.on("connect_error", (err) => {
        console.log(`connect_error due to ${err.message}`);
      });

      this.socket.on("rasa_uttered", (data) => {
        try {
          console.log("rasa_uttered : " + JSON.stringify(data));
          rasaCallback(data);
        } catch (err) {
          console.log(err);
        }
      });

      this.socket.on("llm_uttered", (data) => {
        llmCallback(data);
      });

      this.socket.on("diffusion_ended", (data) => {
        diffusionEndCallback(data);
      });

      this.socket.on("registered", (data) => {
        console.log("registered with hash : ",data);
        this.sessionHash = data;
      })

      this.socket.on("connect_error", (err) => {
        console.log(`connect_error due to ${err.message}`);
      });

      this.socket.on("disconnect", () => {
        console.log("disconnected");
        this.sessionDisconnectFlag = true;
      })

    } catch (err) {
      console.log(err);
    }
  }

  sendUserMessage(message: any) {
    if (this.sessionHash) {
      message.hash = this.sessionHash;
    }
    this.socket.emit('user_uttered', message);
    console.log("user uttered : " + JSON.stringify(message))
  }

  handleRasaMessage(data: any) {
    // Handle Rasa message
    console.log('Rasa message:', data);
  }

  handleLLMMessage(data: any) {
    // Handle LLM message
    console.log('LLM message:', data);
  }

  handleDiffusionEnd(data: any) {
    // Handle diffusion end
    console.log('Diffusion ended:', data);
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
