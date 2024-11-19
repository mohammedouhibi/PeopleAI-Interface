import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ChatbotService } from '../chatbot.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable } from 'rxjs';


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
export class ChatBotComponent implements OnInit, OnChanges {
  @ViewChild('chatInput') chatElement: ElementRef;
  //these variables are to remain static.
  private isLoadingHistory = true;

  //three possible values: 0(checking server availability), 1(server available), 2(server not available)
  private isServerAvailable : number = 0;

  private lastScrollHeight = 0;

  private lastScrollTop = 0;

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

  lastMessageId: string = null;

  resetChatListFlag = false;

  private requestQueue: Promise<void> = Promise.resolve();
  //these variables are to be implemented as component properties
  @Input() user: string = "guest"; //can be anything unique to each user (like a permanent token or ID)
  //valid object (can also be empty)
  @Input() initialMessage: BotResponse = {
    recipient_id: this.user,
    text: "Bonjour, comment puis-je vous aider ?"
  }
  ChatList: PeopleAIChat[] = [];
  DisplayedChatList: PeopleAIChat[] = [];

  @Input() TextUpdateTimeInterval = 100; //in ms

  @Input() defaultprofilepicture: string = "https://client.peopleask.io:8089/DEFAULT_PROFILE_PICTURE_webp.png";

  @Input() kcToken: string = "";
  @Input() serverurl: string = "https://peopleask-server-tn.peopleyou.io:8089";

  @Input() memberInfos: any= null;
  constructor(
    private chatService: ChatbotService,
    private http: HttpClient,
  ) {

  }


  ngOnInit(): void {
    setTimeout(() => {
      if (this.isServerAvailable === 0){
        console.log("server timeout");
        this.isServerAvailable = 2;
      }
    }, 10000);
    this.chatService.setupSocketConnection(
      this.kcToken,
      this.serverurl,
      this.handleRasaResponse.bind(this),
      this.handleLLMresponse.bind(this),
      this.handleDiffusionEnd.bind(this),
      this.onConnect.bind(this));
    //this.getChatHistory();
    this.getBatchedChatHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(this.memberInfos.memberPortal.imageUrl.medium    );
   if (changes['kcToken'] && changes['kcToken'].currentValue !== changes['kcToken'].previousValue) {
      // Reset all component state when @Input() changes
      this.resetChatListFlag = true;
      console.log("token : " + this.kcToken);
    setTimeout(() => {
        console.log("token delayed :"+ this.kcToken);
    }, 2000);
    this.chatService.setupSocketConnection(
      this.kcToken,
      this.serverurl,
      this.handleRasaResponse.bind(this),
      this.handleLLMresponse.bind(this),
      this.handleDiffusionEnd.bind(this),
      this.onConnect.bind(this)
    );
    //this.getChatHistory();
    this.getBatchedChatHistory();
    }
    if (changes['memberInfos'] && changes['memberInfos'].currentValue !== changes['memberInfos'].previousValue) {
      console.log(JSON.stringify(this.memberInfos))
    }
  }

onConnect() {
  this.isServerAvailable = 1;
}


  DisplayMoreChat() {
    const numMessages = 6;
    //add 3 more messages from the end of the list
    var Dlength = this.DisplayedChatList.length;
    if (Dlength + numMessages > this.ChatList.length) {
      Dlength = this.ChatList.length - numMessages;
    }


    this.DisplayedChatList = this.ChatList.slice(this.ChatList.length - Dlength - numMessages, this.ChatList.length);
    this.maintainScrollPosition();
  }

  handleDiffusionEnd(data) {
    console.log("diffusion ended")
    let lastChatEntry: BotResponse = (this.ChatList[this.ChatList.length - 1] as BotResponse);
    if (lastChatEntry.text.length === 0) {
      lastChatEntry.text = "Un problème s'est produit, merci de réessayer.";
      (this.ChatList[this.ChatList.length - 1] as BotResponse).text = lastChatEntry.text;
    }
    this.LLMUtterFlag = false;

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
        setTimeout(() => {

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
    this.isScrolledToBottom = Math.abs(chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight) < 5;

    // Check if scrolled to top and not already loading history
    if (document.getElementById('chat-body').scrollTop === 0
      && !this.isLoadingHistory
      && this.ChatList.length !== this.DisplayedChatList.length) {
      console.log("scrolled to top", document.getElementById('chat-body').scrollTop)
      this.isLoadingHistory = true;
      this.loadMoreHistory();


    }
  }

  loadMoreHistory() {

    this.lastScrollHeight = document.getElementById('chat-body').scrollHeight;
    this.lastScrollTop = document.getElementById('chat-body').scrollTop;
    console.log("loadMoreHistory", this.lastScrollHeight, this.lastScrollTop)
    setTimeout(() => {
      this.DisplayMoreChat();
    }, 500);
  }

  maintainScrollPosition() {
    if (this.isLoadingHistory) {
      const chatBody = document.getElementById('chat-body');
      const newScrollHeight = chatBody.scrollHeight;
      const heightDifference = newScrollHeight - this.lastScrollHeight;
      chatBody.scrollTop = this.lastScrollTop + heightDifference + 8;
      this.isLoadingHistory = false;
      console.log("maintainScrollPosition", "this.lastScrollHeight", this.lastScrollHeight, " newScrollHeight:", newScrollHeight, "heightDifference", heightDifference, "this.lastScrollTop", this.lastScrollTop)
    }
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

      const lastEntryIndex = this.DisplayedChatList.length - 1;
      const lastEntry = (this.DisplayedChatList[lastEntryIndex] as BotResponse);
      const wordList = this.currentBotText.split(" ");
      const fullWordList = wordList.join(" ");
      const jointWordList = wordList.slice(0, index).join(" ");
      //if bot finished typing display all remaining data at once
      //this behavior is currently disabled.
      //this behavior can be modified in a way so that it could be activated or activated with a property value.
      /*if (!this.botTyping) {
        (this.ChatList[lastEntryIndex] as BotResponse) = {
          ...lastEntry,
          recipient_id: this.user,
          text: this.currentBotText
        }
        this.currentBotText = "";
        this.botTypingAnimation = false;

      }
      else {*/
      // if the displayed text (lastEntry.text) is equal to the fullWordList, then call this function again at the same index.
      //this behavior is used to wait for the next bot response
      if (lastEntry.text == fullWordList) {
        //if the bot is no longer typing, exit the recursive loop by not calling this function.
        if (!this.botTyping) {
          this.botTypingAnimation = false;
          return;
        }
        setTimeout(() => {
          this.handleCurrentBotTextByWord(index);
        }, this.TextUpdateTimeInterval);
      }
      else {

        //things to await before ending loop: wait for data if bot still typing, wait for data to be fully displayed
        if (this.currentBotText.length > lastEntry.text.length || this.currentBotText.length > jointWordList.length) {


          if (this.currentBotText.length > 0) {
            (this.DisplayedChatList[lastEntryIndex] as BotResponse) = {
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
          this.ChatList = [...this.ChatList, this.DisplayedChatList[lastEntryIndex]];
        }
      }
      //}
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

  addToChatList(message: PeopleAIChat) {
    this.ChatList.push(message);
    this.DisplayedChatList.push(message);
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
    //replace loading message with response
    this.ChatList.pop();
    this.DisplayedChatList.pop();
    this.addToChatList(newMessage);
    this.handleDiffusionEnd("");
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



  getChatHistory() {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (this.kcToken !== "") {
      headers = headers.set('Authorization', 'Bearer ' + this.kcToken);
    }

    this.http.post<any>(`${this.serverurl}/api/chat/history/all`, { user: this.user, hash: localStorage.getItem("sessionHash") }, { headers: headers })
      .subscribe({
        next: (data) => {
          let newChatHistory: PeopleAIChat[] = this.ChatList;
          data.messages.forEach((message) => {
            if (message.sender === "user") {
              newChatHistory.push({ sender: this.user, message: message.text });
            } else if (message.sender === "bot") {
              newChatHistory.push({ recipient_id: this.user, text: message.text });
            }
          });
          this.ChatList = newChatHistory;
        },
        error: (error) => {
          console.error('Error fetching chat history:', error);
        }
      });
  }



  enqueueRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    const requestPromise = new Promise<T>((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(() => requestFn().toPromise())
        .then(resolve)
        .catch(reject);
    });

    return from(requestPromise);
  }


  getBatchedChatHistory() {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (this.kcToken !== "") {
      headers = headers.set('Authorization', 'Bearer ' + this.kcToken);
    }

    const body = {
      hash: localStorage.getItem("sessionHash"),
      lastMessageId: this.lastMessageId,
      batchSize: 20
    };

    this.enqueueRequest(() => this.http.post<any>(`${this.serverurl}/api/chat/history/batch`, body, { headers: headers }))
      .subscribe({
        next: (data) => {
          this.isLoadingHistory = false;
          let newChatHistory: PeopleAIChat[] = [];
          data.messages.forEach((message) => {
            if (message.sender === "user") {
              newChatHistory.push({ sender: this.user, message: message.text });
            } else if (message.sender === "bot") {
              newChatHistory.push({ recipient_id: this.user, text: message.text });
            }
          });

          // Prepend new messages to the existing chat list
          this.lastMessageId = data.last_message_id;
          this.ChatList = [...newChatHistory, ...this.ChatList];
          if (this.lastMessageId === null || !data.has_more) {
            this.ChatList = [this.initialMessage, ...this.ChatList];
          }
          if (this.resetChatListFlag) {
            this.ChatList = [];
            this.DisplayedChatList = [];
            this.resetChatListFlag = false;

          }
          else
          {
          this.DisplayMoreChat();}

        },
        error: (error) => {
          console.error('Error fetching batched chat history:', error);
          this.isLoadingHistory = false;
        }
      })


  }


  /*getChatHistory(){
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

  }*/

  clearChatHistory() {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (this.kcToken !== "") {
      headers = headers.set('Authorization', 'Bearer ' + this.kcToken);
    }

    this.http.post<any>(`${this.serverurl}/clearChatHistory`, { user: this.user }, { headers: headers }).subscribe({
      next: (data) => {
        this.ChatList = [];
      },
      error: (error) => {
        console.error('Error clearing chat history:', error);
      }
    });
  }


checkState(){
  setTimeout(() => {
    console.log("isServerAvailable:" + this.isServerAvailable, "botTyping:" + this.botTyping + " botTypingAnimation:" + this.botTypingAnimation + " isLoadingHistory:" + this.isLoadingHistory
      +"isLoadingHistory:"+this.isLoadingHistory
    );
    this.checkState();
  }, 5000);
}

  SendMessage() {
    if (this.chatInputValue != "" && !this.botTyping && !this.isLoadingHistory && this.isServerAvailable === 1) {
      this.botTyping = true;
      let newMessage: PeopleAIChat = {
        message: this.chatInputValue,
        sender: this.user
      }
      this.addToChatList(newMessage);
      this.chatInputValue = "";
      let botChat: PeopleAIChat = {
        text: "",
        recipient_id: this.user
      }

      this.addToChatList(botChat);
      this.scrollChatToBottom();
      this.botTypingAnimation = true;
      this.chatService.sendUserMessage(newMessage)
      this.setResponseTimeout(10000);
    }
  }
}
