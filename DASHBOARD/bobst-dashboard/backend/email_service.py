#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EGEM Makine Takip Sistemi - Email Servis
Kullanıcılara mention ve yanıt bildirimleri gönderir
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
import os

class EmailService:
    def __init__(self):
        """
        Email servisi yapılandırması
        SMTP ayarlarını buradan yapılandırın
        """
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = "yasin.egemambalaj@gmail.com"
        self.sender_password = os.environ.get('EMAIL_PASSWORD', '')  # Güvenlik için ortam değişkeninden al
        
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Email gönder
        
        Args:
            to_email: Alıcı email adresi
            subject: Email konusu
            html_content: HTML formatında email içeriği
            
        Returns:
            bool: Başarılı ise True
        """
        try:
            # Email mesajı oluştur
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = to_email
            
            # HTML içeriği ekle
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            # SMTP bağlantısı kur ve email gönder
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(message)
                
            print(f"Email başarıyla gönderildi: {to_email}")
            return True
            
        except Exception as e:
            print(f"Email gönderme hatası: {e}")
            return False
    
    def send_mention_in_feedback(self, to_email: str, username: str, mentioned_by: str, feedback_content: str, feedback_id: int):
        """
        Geri bildirimde bahsedilme bildirimi
        
        Args:
            to_email: Alıcı email
            username: Bahsedilen kullanıcı adı
            mentioned_by: Bahseden kullanıcı adı
            feedback_content: Geri bildirim içeriği
            feedback_id: Geri bildirim ID
        """
        subject = "Egem Dashboard - Geri Bildirimde Bahsedildiniz"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .feedback-box {{ background-color: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔔 Egem Dashboard Geri Bildirim Sistemi</h2>
                </div>
                <div class="content">
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{mentioned_by}</strong> kullanıcısı bir geri bildirimde sizden bahsetti:</p>
                    
                    <div class="feedback-box">
                        <p><em>{feedback_content}</em></p>
                    </div>
                    
                    <p>Geri bildirimi görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
                    
                    <a href="http://192.168.1.44:5173/feedback" class="button">Geri Bildirimi Görüntüle</a>
                </div>
                <div class="footer">
                    <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
                    <p>© 2025 EGEM Makine Takip Sistemi</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)
    
    def send_mention_in_comment(self, to_email: str, username: str, mentioned_by: str, comment_content: str, feedback_id: int):
        """
        Yorumda bahsedilme bildirimi
        
        Args:
            to_email: Alıcı email
            username: Bahsedilen kullanıcı adı
            mentioned_by: Bahseden kullanıcı adı
            comment_content: Yorum içeriği
            feedback_id: Geri bildirim ID
        """
        subject = "Egem Dashboard - Yorumda Bahsedildiniz"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .comment-box {{ background-color: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>💬 Egem Dashboard Geri Bildirim Sistemi</h2>
                </div>
                <div class="content">
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{mentioned_by}</strong> kullanıcısı bir yorumda sizden bahsetti:</p>
                    
                    <div class="comment-box">
                        <p><em>{comment_content}</em></p>
                    </div>
                    
                    <p>Yorumu görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
                    
                    <a href="http://192.168.1.44:5173/feedback" class="button">Yorumu Görüntüle</a>
                </div>
                <div class="footer">
                    <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
                    <p>© 2025 EGEM Makine Takip Sistemi</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)
    
    def send_feedback_reply_notification(self, to_email: str, username: str, replier: str, comment_content: str, original_feedback: str, feedback_id: int):
        """
        Geri bildirime yanıt bildirimi
        
        Args:
            to_email: Alıcı email
            username: Geri bildirim sahibi
            replier: Yanıt veren kullanıcı
            comment_content: Yorum içeriği
            original_feedback: Orijinal geri bildirim
            feedback_id: Geri bildirim ID
        """
        subject = "Egem Dashboard - Geri Bildiriminize Yanıt Geldi"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
                .original-feedback {{ background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }}
                .reply-box {{ background-color: white; padding: 15px; border-left: 4px solid #8b5cf6; margin: 15px 0; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>✉️ Egem Dashboard Geri Bildirim Sistemi</h2>
                </div>
                <div class="content">
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{replier}</strong> kullanıcısı geri bildiriminize yanıt verdi:</p>
                    
                    <div class="original-feedback">
                        <strong>Sizin geri bildiriminiz:</strong>
                        <p><em>{original_feedback}</em></p>
                    </div>
                    
                    <div class="reply-box">
                        <strong>Yanıt:</strong>
                        <p><em>{comment_content}</em></p>
                    </div>
                    
                    <p>Yanıtı görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
                    
                    <a href="http://192.168.1.44:5173/feedback" class="button">Yanıtı Görüntüle</a>
                </div>
                <div class="footer">
                    <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
                    <p>© 2025 EGEM Makine Takip Sistemi</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)


# Global email service instance
email_service = EmailService()

