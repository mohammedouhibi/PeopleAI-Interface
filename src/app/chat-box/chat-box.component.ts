import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { element } from 'protractor';



type UserMessage = {
  message : string,
  sender : string
}

type BotResponse = {
  recipient_id : string,
  text : string,
  buttons? : BotButton[]
}

type BotButton = {
  title : string,
  payload : string
}

type PeopleAIChat = UserMessage | BotResponse


@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.css']
})
export class ChatBoxComponent implements OnInit {

  constructor(private http: HttpClient) { }
  ngOnInit(): void {
  }

  user : string = "Mohamed";

  chatInputValue : string = "";


  ChatList : PeopleAIChat[] = [];

  IsChatActive = true;
  toggleChat() {
    this.IsChatActive = !this.IsChatActive
  }

  SendMessage() {
    if (this.chatInputValue != "") {

      let chatBody = document.getElementById('chat-body');
      let newMessage : PeopleAIChat = {

          message : this.chatInputValue,
          sender : this.user

      }
      this.ChatList.push(newMessage);
      this.chatInputValue = "";
      let botTyping : PeopleAIChat = {
        text : "Typig...",
        recipient_id : this.user
      }

      this.ChatList.push(botTyping);
      setTimeout(() => {

        chatBody.scrollTop = chatBody.scrollHeight;
        }, 500);


      chatBody.scrollTop = chatBody.scrollHeight;
      this.http.post<PeopleAIChat[]>('http://192.168.9.12:5005/webhooks/rest/webhook', newMessage).subscribe((data) => {
        let botResponse : string = "";
        let buttons : BotButton[] = [];
        //cycle through list of data objects
        for (let response of data) {
          botResponse = botResponse + "\n" +response['text'];
          if (response['buttons'] != null && response['buttons'].length > 0) {
            for (let button of buttons) {
              button.title = JSON.parse(`"${button.title}"`)
            }
            buttons.push(response['buttons'])  ;
          }
        }
        let newMessage : PeopleAIChat = {
          recipient_id : this.user,
          text : botResponse,
          buttons : buttons
        }

        //replace loading message with response
        this.ChatList.pop();
        this.ChatList.push(newMessage);
        //get element by ID and scroll to bottom
        setTimeout(() => {

        chatBody.scrollTop = chatBody.scrollHeight;
        }, 1000);
      })
    }
  }


}
