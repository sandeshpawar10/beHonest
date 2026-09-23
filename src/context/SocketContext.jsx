/* eslint-disable */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { session, loading } = useAuth(); 

    useEffect(() => {
        if (loading) return;

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        const newSocket = io(apiUrl, {
            withCredentials: true,
        });

        // eslint-disable-next-line
        // eslint-disable-next-line
        setSocket(newSocket);

        if (session && (session._id || session.id)) {
            newSocket.emit('join_user_room', (session._id || session.id));
        }

        return () => {
            newSocket.close();
        };
    }, [session, loading]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

