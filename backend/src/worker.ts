import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

let transporter: nodemailer.Transporter | null = null;
let testAccount: nodemailer.TestAccount | null = null;

export async function getTransporter() {
  if (transporter && testAccount) {
    return {
      transporter,
      account: testAccount
    };
  }

  console.log("Creating Ethereal test account...");

  testAccount = await nodemailer.createTestAccount();

  console.log("Ethereal account created successfully");

  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
  });

  return {
    transporter,
    account: testAccount
  };
}