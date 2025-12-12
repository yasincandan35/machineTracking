import React, { useEffect, useMemo, useState } from 'react';
import MachineScreenApp from '../machineScreen/src/App';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../utils/api';

const MachineScreenPage = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [resolvedMachine, setResolvedMachine] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!isLoading && user && user.role !== 'machine') {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        Yükleniyor...
      </div>
    );
  }

  if (!user || user.role !== 'machine') {
    return null;
  }

  const assignedMachine = useMemo(() => ({
    id: user.assignedMachineId ?? user.lastSelectedMachineId ?? null,
    tableName: user.assignedMachineTable ?? null,
    machineName: user.assignedMachineName ?? null,
  }), [user.assignedMachineId, user.lastSelectedMachineId, user.assignedMachineTable, user.assignedMachineName]);

  useEffect(() => {
    setResolvedMachine(assignedMachine);
  }, [assignedMachine]);

  useEffect(() => {
    let isMounted = true;

    const fetchMachineDetails = async () => {
      if (!assignedMachine.id || assignedMachine.tableName) {
        return;
      }

      try {
        setIsResolving(true);
        const response = await dashboardApi.get(`/machines/${assignedMachine.id}`);
        if (!isMounted) return;

        const machine = response.data;
        if (machine) {
          setResolvedMachine({
            id: machine.id,
            tableName: machine.tableName,
            machineName: machine.machineName,
          });
        }
      } catch (error) {
        console.warn('Makine detayları alınamadı:', error);
      } finally {
        if (isMounted) {
          setIsResolving(false);
        }
      }
    };

    fetchMachineDetails();

    return () => {
      isMounted = false;
    };
  }, [assignedMachine.id, assignedMachine.tableName]);

  const hasMachineId = resolvedMachine?.id !== null && resolvedMachine?.id !== undefined;
  if (!hasMachineId || !resolvedMachine?.tableName) {
    console.warn('Makine ataması eksik:', {
      assignedMachineId: user.assignedMachineId,
      assignedMachineTable: user.assignedMachineTable,
      assignedMachineName: user.assignedMachineName,
      lastSelectedMachineId: user.lastSelectedMachineId,
    });

    if (isResolving) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          textAlign: 'center',
          padding: '0 24px',
          fontSize: '1.1rem',
          color: '#2563eb'
        }}>
          Makine bilgileri yükleniyor...
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        height: '100vh',
        textAlign: 'center',
        padding: '0 24px',
        fontSize: '1.1rem',
        color: '#dc2626'
      }}>
        Bu kullanıcı için makine ataması yapılmamış.
        <br />
        Lütfen sistem yöneticinize başvurun.
      </div>
    );
  }

  return <MachineScreenApp machineInfo={resolvedMachine} language={user.languageSelection || 'tr'} />;
};

export default MachineScreenPage;

