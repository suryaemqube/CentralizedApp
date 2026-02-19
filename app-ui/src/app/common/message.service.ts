import { Injectable, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
@Injectable()


export class MessageService {

    constructor(public toastr: ToastrService, vcr: ViewContainerRef) {
    }

    private subject = new Subject<any>();

    showMessage(message: string, type: number) {

        switch (type) {

            case 1:
                this.toastr.warning(message, '', { timeOut: 7000, enableHtml: true });
                break;
            case 2:
                this.toastr.error(message, '', { timeOut: 7000, enableHtml: true });
                break;
            case 3:
                this.toastr.info(message, '', { timeOut: 7000, enableHtml: true })
                break;
            case 4:
                this.toastr.success(message, '', { timeOut: 8000, enableHtml: true })
                break;
            default:
                this.toastr.error(message, '', { timeOut: 7000, enableHtml: true });
                break;
        }
    }
}
