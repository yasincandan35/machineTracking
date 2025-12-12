import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Calendar, Trash2, Edit3, ThumbsUp, ThumbsDown, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useColor } from '../contexts/ColorContext';
import { getTranslation } from '../utils/translations';
import { api } from '../utils/api';
import MentionInput from '../components/Common/MentionInput';

const FeedbackPage = ({ currentLanguage = 'tr' }) => {
  const { user } = useAuth();
  const { colorSettings } = useColor();
  const [feedbacks, setFeedbacks] = useState([]);
  const [newFeedback, setNewFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [reactions, setReactions] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userReactions, setUserReactions] = useState({});

  // Geri bildirimleri yükle
  useEffect(() => {
    fetchFeedbacks();
  }, []);

  // Dark mode kontrolü
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Dark mode değişikliklerini dinle
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/feedback');
      setFeedbacks(response.data || []);
      
      // Kullanıcının tepkilerini yükle
      if (user?.id) {
        const userReactionsData = {};
        response.data?.forEach(feedback => {
          const userReaction = feedback.reactions?.find(r => r.userId === user.id);
          if (userReaction) {
            userReactionsData[feedback.id] = userReaction.reactionType;
          }
        });
        setUserReactions(userReactionsData);
      }
    } catch (error) {
      console.error('Geri bildirimler yüklenemedi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mention'ları çıkar - nokta (.) ve tire (-) destekli
  const extractMentions = (text) => {
    const mentionRegex = /@([\w.-]+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newFeedback.trim()) return;

    try {
      const mentions = extractMentions(newFeedback);
      
      const response = await api.post('/feedback', {
        content: newFeedback.trim(),
        userId: user.id,
        userName: user.username,
        mentions: mentions
      });
      
      setFeedbacks([response.data, ...feedbacks]);
      setNewFeedback('');
    } catch (error) {
      console.error('Geri bildirim gönderilemedi:', error);
    }
  };


  const handleDelete = async (id) => {
    if (!window.confirm(getTranslation('confirmDelete', currentLanguage))) return;

    try {
      await api.delete(`/feedback/${id}`);
      setFeedbacks(feedbacks.filter(f => f.id !== id));
    } catch (error) {
      console.error('Geri bildirim silinemedi:', error);
    }
  };

  // Yorum fonksiyonları
  const handleAddComment = async (feedbackId) => {
    if (!newComment[feedbackId]?.trim()) return;

    try {
      const mentions = extractMentions(newComment[feedbackId]);
      
      const response = await api.post('/comments', {
        feedbackId,
        content: newComment[feedbackId].trim(),
        userId: user.id,
        userName: user.username,
        mentions: mentions
      });
      
      // Geri bildirimleri yeniden yükle
      await fetchFeedbacks();
      setNewComment({ ...newComment, [feedbackId]: '' });
    } catch (error) {
      console.error('Yorum eklenemedi:', error);
    }
  };

  const handleDeleteComment = async (commentId, feedbackId) => {
    if (!window.confirm(getTranslation('confirmDeleteComment', currentLanguage))) return;

    try {
      await api.delete(`/comments/${commentId}`);
      await fetchFeedbacks();
    } catch (error) {
      console.error('Yorum silinemedi:', error);
    }
  };

  // Beğeni fonksiyonları
  const handleReaction = async (feedbackId, reactionType) => {
    try {
      // Önce UI'yi güncelle (optimistic update)
      setUserReactions(prev => ({
        ...prev,
        [feedbackId]: reactionType
      }));

      await api.post('/feedbackreactions', {
        feedbackId,
        userId: user.id,
        reactionType
      });
      
      // Geri bildirimleri yeniden yükle
      await fetchFeedbacks();
    } catch (error) {
      console.error('Tepki gönderilemedi:', error);
      // Hata durumunda UI'yi geri al
      setUserReactions(prev => ({
        ...prev,
        [feedbackId]: null
      }));
    }
  };

  const toggleComments = (feedbackId) => {
    setShowComments(prev => ({
      ...prev,
      [feedbackId]: !prev[feedbackId]
    }));
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto" style={{ color: colorSettings.text }}>
      {/* Başlık */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-gray-800 dark:text-white">
          <MessageSquare className="text-blue-500" size={32} />
          {getTranslation('feedback', currentLanguage)}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          {getTranslation('feedbackDescription', currentLanguage)}
        </p>
      </div>

      {/* Yeni geri bildirim formu */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-white">
          <Send className="text-green-500" size={20} />
          {getTranslation('newFeedback', currentLanguage)}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <MentionInput
            value={newFeedback}
            onChange={(e) => setNewFeedback(e.target.value)}
            placeholder={getTranslation('feedbackPlaceholder', currentLanguage) + ' (@kullanıcıadı ile etiketleyebilirsiniz)'}
            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            rows={4}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newFeedback.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              {getTranslation('send', currentLanguage)}
            </button>
          </div>
        </form>
      </div>

      {/* Geri bildirimler listesi */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          {getTranslation('allFeedbacks', currentLanguage)} ({feedbacks.length})
        </h2>
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              {getTranslation('loading', currentLanguage)}...
            </p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-300">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>{getTranslation('noFeedbacks', currentLanguage)}</p>
          </div>
        ) : (
          feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white">{feedback.userName}</h3>
                    <p className="text-sm flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <Calendar size={14} />
                      {formatDate(feedback.createdAt)}
                    </p>
                  </div>
                </div>
                
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(feedback.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              
              <p className="leading-relaxed text-gray-800 dark:text-white">
                {feedback.content}
              </p>

              {/* Beğeni butonları */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => handleReaction(feedback.id, 'like')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                    userReactions[feedback.id] === 'like' 
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 shadow-md' 
                      : 'hover:bg-green-50 dark:hover:bg-green-800 text-green-500 dark:text-green-400'
                  }`}
                >
                  <ThumbsUp 
                    size={18} 
                    className={`transition-transform duration-200 ${
                      userReactions[feedback.id] === 'like' ? 'scale-110' : ''
                    }`}
                  />
                  <span className="font-medium">{feedback.likeCount || 0}</span>
                </button>
                <button
                  onClick={() => handleReaction(feedback.id, 'dislike')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                    userReactions[feedback.id] === 'dislike' 
                      ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 shadow-md' 
                      : 'hover:bg-red-50 dark:hover:bg-red-800 text-red-500 dark:text-red-400'
                  }`}
                >
                  <ThumbsDown 
                    size={18} 
                    className={`transition-transform duration-200 ${
                      userReactions[feedback.id] === 'dislike' ? 'scale-110' : ''
                    }`}
                  />
                  <span className="font-medium">{feedback.dislikeCount || 0}</span>
                </button>
                <button
                  onClick={() => toggleComments(feedback.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                    showComments[feedback.id] 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 shadow-md' 
                      : 'hover:bg-blue-50 dark:hover:bg-blue-800 text-blue-500 dark:text-blue-400'
                  }`}
                >
                  <MessageCircle 
                    size={18} 
                    className={`transition-transform duration-200 ${
                      showComments[feedback.id] ? 'scale-110' : ''
                    }`}
                  />
                  <span className="font-medium">{feedback.comments?.length || 0}</span>
                </button>
              </div>

              {/* Yorumlar bölümü */}
              {showComments[feedback.id] && (
                <div className="mt-4 space-y-4">
                  {/* Yorum ekleme formu */}
                  <div className="flex gap-2 flex-col">
                    <MentionInput
                      value={newComment[feedback.id] || ''}
                      onChange={(e) => setNewComment({ ...newComment, [feedback.id]: e.target.value })}
                      placeholder={getTranslation('writeComment', currentLanguage) + ' (@kullanıcıadı ile etiketleyebilirsiniz)'}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      rows={3}
                    />
                    <button
                      onClick={() => handleAddComment(feedback.id)}
                      disabled={!newComment[feedback.id]?.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed self-end flex items-center gap-2"
                    >
                      <Send size={16} />
                      {getTranslation('send', currentLanguage)}
                    </button>
                  </div>

                  {/* Yorumlar listesi */}
                  <div className="space-y-3">
                    {feedback.comments?.map((comment) => (
                      <div 
                        key={comment.id} 
                        className="rounded-lg p-3"
                        style={{ 
                          backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                          color: isDarkMode ? '#f3f4f6' : '#1f2937',
                          background: isDarkMode ? '#374151' : '#f3f4f6',
                          '--tw-bg-opacity': '1',
                          '--tw-text-opacity': '1'
                        }}
                        data-dark-mode={isDarkMode}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                              <User size={12} />
                            </div>
                            <span 
                              className={`font-medium text-sm ${isDarkMode ? '!text-gray-200' : '!text-gray-800'}`}
                            >
                              {comment.userName}
                            </span>
                            <span 
                              className={`text-xs ${isDarkMode ? '!text-gray-400' : '!text-gray-600'}`}
                            >
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteComment(comment.id, feedback.id)}
                              className="text-red-500 hover:opacity-80 rounded p-1 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <p 
                          className={`text-sm ${isDarkMode ? '!text-gray-200' : '!text-gray-800'}`}
                        >
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
