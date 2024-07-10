import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { ChatbotService } from '../chatbot.service';


type UserMessage = {
  message: string,
  sender: string
}

type BotResponse = {
  recipient_id: string,
  text: string,
  buttons?: BotButton[]
}

type BotButton = {
  title: string,
  payload: string
}

type PeopleAIChat = UserMessage | BotResponse


@Component({
  selector: 'app-chat-bot',
  templateUrl: './chat-bot.component.html',
  styleUrls: ['./chat-bot.component.css']
})
export class ChatBotComponent implements OnInit {

  @ViewChild('chatInput') chatElement: ElementRef;



  //these variables are to remain static.
  chatInputValue = "";

  botTyping = false;

  botTypingAnimation = false;

  currentBotText = "";

  isScrolledToBottom = true;

  LLMUtterFlag = false;

  isChatboxActive = false;

  PopupFlag = false;

  isExtended = false;

  responseTimeout: any = null;

  //these variables are to be implemented as component properties
  @Input() user: string = "guest"; //can be anything unique to each user (like a permanent token or ID)
  //valid object (can also be empty)
  @Input()ChatList: PeopleAIChat[] = [{
    recipient_id: this.user,
    text: "Bonjour, comment puis-je vous aider ?"
  }
  ];
   @Input() TextUpdateTimeInterval = 100; // in ms

  @Input() ProfilePicture: string = "https://client.peopleask.io:8089/DEFAULT_PROFILE_PICTURE_webp.png";

  constructor(
    private chatService: ChatbotService,
  ) {
  }


  handleDiffusionEnd(data) {
    let lastChatEntry : BotResponse = (this.ChatList[this.ChatList.length - 1] as BotResponse);
    if (lastChatEntry.text.length === 0) {
      lastChatEntry.text = "un problème s'est produit, merci de réessayer";
      (this.ChatList[this.ChatList.length - 1] as BotResponse).text = lastChatEntry.text;
    }
    this.LLMUtterFlag = false;
    this.botTypingAnimation = false;
    this.botTyping = false;
    this.clearResponseTimeout();
  }



  setResponseTimeout(duration: number = 3000) {
    console.log("attempting set timeout")
    if (!this.responseTimeout) {

      this.responseTimeout = setTimeout(() => {
        console.log("timeout executing")
        this.handleDiffusionEnd("");
        this.responseTimeout = null;
        var lasEntryIndex = this.ChatList.length - 1;
        setTimeout(() => {
          (this.ChatList[lasEntryIndex] as BotResponse).text
            = "Je suis désolé mais je ne peux pas repondre à cette question. Merci de reprendre votre question. ";

          this.handleDiffusionEnd("");
        }
          , 500);
      }, duration);
      console.log("set timeout :", duration)
    }
  }

  refreshResponseTimeout() {
    console.log("attempting refresh timeout")
    if (this.responseTimeout) {
      console.log("refresh timeout")
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
      this.setResponseTimeout();
    }
  }

  clearResponseTimeout() {
    if (this.responseTimeout) {
      console.log("clear timeout")
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
  }

  onScroll() {
    const chatBody = document.getElementById('chat-body');
    this.isScrolledToBottom =
      Math.abs(chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight) < 5;
  }

  sayHi() {
    console.log("hi")
  }

  scrollChatToBottom() {
    setTimeout(() => {
      let chatBody = document.getElementById('chat-body');
      if (chatBody)
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 300)

  }

  toggleExtended() {
    this.isExtended = !this.isExtended;
  }

  showPopup() {
    const popupElement = document.querySelector('.chatbot-popup');
    this.PopupFlag = true;
    popupElement?.classList.add('show');
    popupElement?.classList.add('expanded');
  }

  hidePopup() {
    this.PopupFlag = false;
    setTimeout(() => {
      if (!this.PopupFlag) {
        const popupElement = document.querySelector('.chatbot-popup');
        if (popupElement) {
          popupElement?.classList.remove('expanded');
          setTimeout(() => {
            popupElement?.classList.remove('show');
          }, 500); // Adjust the delay as needed
        }
      }
      else {
        this.hidePopup()
      }
    }, 3000)

  }

  resetChatbox() {
    this.ChatList = [];
    this.currentBotText = "";
    this.isChatboxActive = false;
    this.isExtended = false;
    this.clearChatHistory();
  }

  handleCurrentBotTextByWord(index) {
    try {

      const lastEntryIndex = this.ChatList.length - 1;
      const lastEntry = (this.ChatList[lastEntryIndex] as BotResponse);
      const wordList = this.currentBotText.split(" ");
      const fullWordList = wordList.join(" ");
      const jointWordList = wordList.slice(0, index).join(" ");
      //if bot finished typing display all remaining data at once
      if (!this.botTyping) {
        (this.ChatList[lastEntryIndex] as BotResponse) = {
          ...lastEntry,
          recipient_id: this.user,
          text: this.currentBotText
        }
        this.currentBotText = "";
        this.botTypingAnimation = false;

      }
      else {
        // if the displayed text (lastEntry.text) is equal to the fullWordList, then no action is needed.
        if (lastEntry.text == fullWordList) {
          setTimeout(() => {
            this.handleCurrentBotTextByWord(index);
          }, this.TextUpdateTimeInterval);
        }
        else {

          //things to await before ending loop: wait for data if bot still typing, wait for data to be fully displayed
          if (this.currentBotText.length > lastEntry.text.length || this.currentBotText.length > jointWordList.length) {


            if (this.currentBotText.length > 0) {
              (this.ChatList[lastEntryIndex] as BotResponse) = {
                ...lastEntry,
                recipient_id: this.user,
                text: jointWordList
              }

              this.scrollChatToBottom();
              setTimeout(() => {
                this.handleCurrentBotTextByWord(index + 1);
              }, this.TextUpdateTimeInterval);
            }
          }


          else {
            this.currentBotText = "";
            this.botTypingAnimation = false;
            this.LLMUtterFlag = false;
          }
        }
      }
    }
    catch (err) {
      console.error(err);
    }
  }



  toggleChatbox() {
    this.isChatboxActive = !this.isChatboxActive;
    setTimeout(() => {
      this.chatElement.nativeElement.focus();
      this.scrollChatToBottom();
    }, 0);
  }


  handleRasaResponse(data) {

    let botResponse: string = "";
    let buttons: BotButton[] = [];

    //cycle through list of data objects
    for (let response of data) {
      if (botResponse.length > 0) {
      botResponse = botResponse + "\n" + response['text'];
      }
      else {
        botResponse = response['text'];
      }
      if (response['buttons'] != null && response['buttons'].length > 0) {
        for (let button of buttons) {
          button.title = JSON.parse(`"${button.title}"`)
        }
        buttons.push(response['buttons']);
      }
    }
    let newMessage: PeopleAIChat = {
      recipient_id: this.user,
      text: botResponse,
      buttons: buttons
    }

    //change all flags significant for bot response to false after response is received
    this.botTypingAnimation = false;
    this.handleDiffusionEnd("");
    //replace loading message with response
    this.ChatList.pop();
    this.ChatList.push(newMessage);
    //get element by ID and scroll to bottom
    setTimeout(() => {
      this.scrollChatToBottom();
    }, 300);
  }

  onButtonClick(payload) {
    console.log("clicked button with payload: " + payload)
  }

  //handles streamed text only data
  handleLLMresponse(data) {
    this.currentBotText = data;
    console.log("LLM added text" + this.currentBotText)
    this.refreshResponseTimeout();
    if (!this.LLMUtterFlag) {
      this.LLMUtterFlag = true;
      this.handleCurrentBotTextByWord(0);
      //this.handleCurrentBotTextByCharacter(0);
    }
  }



getChatHistory(){
  fetch('https://peopleask-server-tn.peopleyou.io:8089/getChatHistory',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: this.user
      })
    }
  ).then((response) => {
    response.json().then((data) => {
      let newChatHistory: PeopleAIChat[] = this.ChatList;

      data.messages.forEach((message) => {
        if (message.sender === "user") {
          newChatHistory.push({
            sender: this.user,
            message: message.text
          })}
        else if (message.sender === "bot") {
          newChatHistory.push({
            recipient_id: this.user,
            text: message.text
          })
        }

        this.ChatList = newChatHistory;
      })
    })
  })

}

clearChatHistory(){
  fetch('https://peopleask-server-tn.peopleyou.io:8089/clearChatHistory',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: this.user
      })
    }
  ).then((response) => {
    response.json().then((data) => {
        this.ChatList = [];
      }).catch((err) => {
        console.error(err);
      })
    })

}

  ngOnInit(): void {
    this.chatService.setupSocketConnection(this.handleRasaResponse.bind(this),
      this.handleLLMresponse.bind(this), this.handleDiffusionEnd.bind(this));
    this.getChatHistory();


  }



  SendMessage() {
    if (this.chatInputValue != "" && !this.botTyping) {
      this.botTyping = true;
      let newMessage: PeopleAIChat = {

        message: this.chatInputValue,
        sender: this.user

      }
      this.ChatList.push(newMessage);
      this.chatInputValue = "";
      let botChat: PeopleAIChat = {
        text: "",
        recipient_id: this.user
      }

      this.ChatList.push(botChat);


      this.scrollChatToBottom();
      this.botTypingAnimation = true;
      this.chatService.sendUserMessage(newMessage)
      this.setResponseTimeout(10000);
    }
  }



}
