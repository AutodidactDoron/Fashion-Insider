import React from 'react';
import MainLayout from '../components/MainLayout'; // ודא שהנתיב ל-Layout מדויק לפי הפרויקט שלך
import MyPostsContent from '../components/MyPostsContent';

export default function MyPosts() {
  return (
    <MainLayout>
      <MyPostsContent />
    </MainLayout>
  );
}