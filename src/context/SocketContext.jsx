/* eslint-disable */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socketReady, setSocketReady] = useState(false);
    const socketRef = useRef(null);
    const { session, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        // Clean up previous socket if any
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            setSocketReady(false);
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        const newSocket = io(apiUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

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
