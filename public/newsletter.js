// Substack owns signup, consent, and confirmation inside its cross-origin iframe.
// Loading or focusing that iframe is not evidence of a completed subscription.
const $=id=>document.getElementById(id);
const reminderKey='ocr-rush:newsletter-reminders-dismissed';
let dismissed=false,trigger=null;
try{dismissed=localStorage.getItem(reminderKey)==='true';}catch{}

export function showNewsletterInvite(){
 $('newsletter-invite').hidden=dismissed;
}

$('newsletter-dismiss').onclick=()=>{
 dismissed=true;
 $('newsletter-invite').hidden=true;
 // A display preference only. Never store an email or a claimed subscriber status.
 try{localStorage.setItem(reminderKey,'true');}catch{}
};

const dialog=$('newsletter-dialog');
$('newsletter-open').onclick=()=>{
 trigger=document.activeElement;
 const frame=$('newsletter-dialog-embed');
 if(!frame.hasAttribute('src'))frame.src=frame.dataset.src;
 dialog.showModal();
};
$('newsletter-close').onclick=$('newsletter-continue').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>trigger?.focus?.({preventScroll:true}));
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const box=dialog.getBoundingClientRect();
 if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
});
