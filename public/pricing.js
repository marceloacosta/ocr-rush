// Frankfurt course infrastructure snapshot + official regional S3 offer, USD.
// Pinned planning estimate, not a live AWS quote. 730 hours per month.
export const PRICING={region:'eu-central-1',reviewed:'2026-09-23',gpuHour:3.757,layoutHour:1.505,baseHour:530/730,gpuDiskHour:200*.0952/730,sqsRequest:.40/1e6,s3Put:.0054/1000,s3Get:.00043/1000,s3GBMonth:.0245};
export const SOURCES=[
 ['AWS deployment and pricing reference','https://theneuralmaze.substack.com/p/deploying-a-production-ocr-system'],
 ['EC2 billing: per second, 60-second minimum','https://aws.amazon.com/ec2/pricing/on-demand/'],
 ['SQS requests and billing rules','https://aws.amazon.com/sqs/pricing/'],
 ['S3 Frankfurt regional price file','https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-central-1/index.json'],
 ['S3 conditional writes','https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html'],
 ['Textract prices by page and extraction feature','https://aws.amazon.com/textract/pricing/']
];
const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
export const money=n=>dollars.format(Number(n));
export const smallMoney=n=>n>0&&n<.01?'Less than $0.01':money(n);
export function duration(s){if(s===null||s===undefined)return '—';s=Math.round(s*10)/10;return s<60?`${s} s`:`${Math.floor(s/60)} min${s%60?` ${Math.round((s%60)*10)/10} s`:''}`;}
export const clockTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
