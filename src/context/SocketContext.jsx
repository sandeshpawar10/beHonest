/* eslint-disable */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// Helper to extract accesstoken from document.cookie
function getAccessTokenFromCookie() {
    const cookies = document.cookie.split('; ');
    const accessTokenCookie = cookies.find(row => row.startsWith('accesstoken='));
    return accessTokenCookie ? accessTokenCookie.split('=')[1] : null;
}

export const SocketProvider = ({ children }) => {
    const [socketReady, setSocketReady] = useState(false);
    const socketRef = useRef(null);
    const { session, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        // Only connect if user is authenticated
        if (!session) {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
                setSocketReady(false);
            }
            return;
        }

        // Clean up previous socket if any
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            setSocketReady(false);
        }

        const apiUrl = import.meta.env.VITE_API_URL || '';
        const token = getAccessTokenFromCookie();

        // Socket.IO connection options
        const socketOptions = {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        };

        // Pass token explicitly if available (fallback to cookie)
        if (token) {
            socketOptions.auth = { token };
        }

        const newSocket = io(apiUrl, socketOptions);
        socketRef.current = newSocket;

        // Wait for actual connection before joining room
        newSocket.on('connect', () => {
            console.log('[Socket] Connected:', newSocket.id);
            const userId = session?._id || session?.id;
            if (userId) {
                newSocket.emit('join_user_room', userId);
                console.log('[Socket] Joined user room:', userId);
            }
            setSocketReady(true);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);

            // Handle authentication failures
            if (err.message.includes('Authentication') ||
                err.message.includes('token') ||
                err.message.includes('expired')) {
                console.warn('[Socket] Authentication failed. User may need to log in again.');
                setSocketReady(false);
            }
        });

        newSocket.on('error', (error) => {
            console.error('[Socket] Socket error:', error.message);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setSocketReady(false);
        });

        return () => {
            newSocket.close();
            socketRef.current = null;
            setSocketReady(false);
        };
    }, [session, loading]);

    return (
        <SocketContext.Provider value={socketRef.current}>
            {children}
        </SocketContext.Provider>
    );
};
