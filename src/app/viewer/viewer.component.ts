import {
  Component,
  OnInit,
  AfterViewInit,
  Input,
  Inject,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
  NgZone
} from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatSnackBar } from '@angular/material';
import { JsonEditorComponent, JsonEditorOptions } from 'ang-jsoneditor';

import { Subscription } from 'rxjs';
import { OpenfinService } from '../openfin.service';

export interface DialogData {
  json: string;
  data: any;
}

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css']
})
export class ViewerComponent implements OnInit {

  @Input() runtime: string;
  @Input() uuid: string;
  @Input() topic: string;
  @ViewChild('viewerLog') viewerLog: ElementRef;
  @ViewChildren('messageItems') messageItems: QueryList<any>;

  json: string;
  data: any;
  message: string = '';
  dateOptions: any = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  /*messages: any = [
    {
      participant: 'factset-prod-main',
      datetime: new Date().toLocaleString('en-US'),
      content: '{ "com.factset.symbology.entity":"0016YD-E","com.factset.symbology.regionalticker":"FDS-US" }'
    },
    {
      participant: 'user',
      datetime: new Date().toLocaleString('en-US'),
      content: '{ "awesomenessLevel":"too much to handle" }'
    },
    {
      participant: 'random-client-app',
      datetime: new Date().toLocaleString('en-US'),
      content: '{ "com.factset.symbology.entity":"00ABYD-Z","com.factset.symbology.regionalticker":"VIX" }'
    },
    {
      participant: 'factset-prod-main',
      datetime: new Date().toLocaleString('en-US'),
      content: '{ "com.factset.symbology.entity":"0016YD-E","com.factset.symbology.regionalticker":"FDS-US" }'
    },
  ];
  participants: any = {
    'user': '#2196F3',
    'factset-prod-main': '#4DB6AC', // 300 level palette color
    'random-client-app': '#FFC107'
  };*/
  messages: any = [];
  participants: any = {};
  colors: any = [

  ];

  constructor(public openfin: OpenfinService,
              public dialog: MatDialog,
              public zone: NgZone) {
  }

  ngOnInit() {
    this.subscribe();
  }

  ngAfterViewInit() {
    this.messageItems.changes.subscribe(t => {
      this.scrollToEnd();
    });
  }

  subscribe() {
    this.openfin.subscribe(this.runtime, this.uuid, this.topic).subscribe(data => {
      this.zone.run(() => {
        console.log(data.sender.uuid + ' : ' + data.message); // sender -> uuid, name
        // add to message items
        if (!this.participants.hasOwnProperty(data.sender.uuid)) {
          this.participants[data.sender.uuid] = {
            name: data.sender.name ? data.sender.name : data.sender.uuid,
            uuid: data.sender.uuid,
            color: '#4DB6AC' // TODO* random color here
          };
        }

        this.messages.push({
          participant: this.participants[data.sender.uuid].name,
          datetime: new Date().toLocaleString('en-US'), // TODO* get time from OF object
          content: data.message
        });
      });
    });
  }

  getParticipantColor(participant: string): string {
    return this.participants[participant].color;
  }

  parseMessage(message: string) {
    // get uuid and relevant identifying info and add to participants
    // get data object and store in messages as message
  }

  openJson(data: string) {
    const dialogRef = this.dialog.open(AddJsonDialogComponent, {
      width: '50%',
      data: JSON.parse(data)
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.message = JSON.stringify(result);
      }
    });
  }

  addJson() {
    const dialogRef = this.dialog.open(AddJsonDialogComponent, {
      width: '50%',
      data: this.message ? JSON.parse(this.message) : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.message = JSON.stringify(result);
      }
    });
  }

  send() {
    if (this.message && JSON.parse(this.message)) {
      this.messages.push({
        participant: 'user',
        datetime: new Date().toLocaleString('en-US'),
        content: this.message
      });
      this.message = '';
    }
  }

  scrollToEnd() {
    this.viewerLog.nativeElement.scrollTop = this.viewerLog.nativeElement.scrollHeight;
  }

  waitScrollToEnd() {
    setTimeout(() => {
      this.scrollToEnd();
    }, 0);
  }

  onKey(event: any) {
    this.message = event.target.value;
  }

  // TODO* move this to pipe
  prettifyJson(json: string) {
    json = JSON.parse(json);
    json = JSON.stringify(json, undefined, 4);
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
            cls = 'key';
        } else {
            cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

}

@Component({
  selector: 'app-add-json-dialog',
  template: `
    <h1 mat-dialog-title>Add JSON</h1>
    <div mat-dialog-content>
      <json-editor [options]="editorOptions" [data]="data"></json-editor>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="onNoClick()">Cancel</button>
      <button mat-button [mat-dialog-close]="data" cdkFocusInitial>Ok</button>
      <button mat-button (click)="onCopy()" style="margin-left: auto;">Copy</button>
    </div>
  `,
  styleUrls: ['./viewer.component.css']
})
export class AddJsonDialogComponent {

  @ViewChild(JsonEditorComponent) editor: JsonEditorComponent;

  editorOptions: JsonEditorOptions;

  constructor(public dialogRef: MatDialogRef<AddJsonDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.editorOptions = new JsonEditorOptions();
    this.editorOptions.modes = ['code', 'text', 'tree', 'view']; // set all allowed modes
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onCopy(): void {

  }

}