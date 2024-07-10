import { BrowserModule } from '@angular/platform-browser';
import { Injector, NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { FormsModule } from '@angular/forms';
import { HttpClientModule} from   '@angular/common/http'
import { createCustomElement } from '@angular/elements';
import { ChatBotComponent } from './chat-bot/chat-bot.component';
@NgModule({
  declarations: [
    ChatBotComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  entryComponents: [ChatBotComponent]
})
export class AppModule {

    constructor(injector : Injector) {
      const chatBot = createCustomElement(ChatBotComponent, {injector});
      customElements.define('ai-chat-bot', chatBot);
    }

    ngDoBootstrap() {}
}
