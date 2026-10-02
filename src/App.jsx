import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Search, QrCode, Plus, X, LogOut, Download, MessageCircle } from 'lucide-react';

import logoImg from './assets/logo.png'; 
import './App.css';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroServicio, setFiltroServicio] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Modales
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalScanner, setModalScanner] = useState(false);

  // Formularios
  const [formData, setFormData] = useState({
    nombre_apellido: '',
    fecha_nacimiento: '',
    telefono: '',
    fecha_membresia: '',
    servicios: []
  });

  useEffect(() => {
    if (isAuthenticated) {
      cargarClientes();
    }
  }, [isAuthenticated]);

  const cargarClientes = async () => {
    const { data, error } = await supabase.from('clientes').select('*');
    if (!error && data) {
      setClientes(data);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setErrorMessage('');
  };

  const obtenerEstado = (fechaStr) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaVencimiento = new Date(fechaStr + 'T00:00:00');
    
    const diffTime = fechaVencimiento - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'caducada'; // Rojo
    if (diffDays <= 5) return 'por-vencer'; // Naranja
    return 'activa'; // Verde
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'Volcano' && password === 'Volcano-123404') {
      setIsAuthenticated(true);
      setErrorMessage('');
    } else {
      setErrorMessage('Usuario o contraseña incorrectos');
    }
  };

  const handleCheckboxChange = (servicio) => {
    setFormData(prev => {
      const existe = prev.servicios.includes(servicio);
      let nuevos = existe 
        ? prev.servicios.filter(s => s !== servicio)
        : [...prev.servicios, servicio];
      return { ...prev, servicios: nuevos };
    });
  };

  const guardarCliente = async (e) => {
    e.preventDefault();

    if (!formData.servicios || formData.servicios.length === 0) {
      alert('Debes seleccionar al menos un servicio (Gym o Box).');
      return;
    }

    const datosAEnviar = {
      nombre_apellido: formData.nombre_apellido.trim(),
      fecha_nacimiento: formData.fecha_nacimiento ? formData.fecha_nacimiento : null,
      telefono: formData.telefono ? formData.telefono.trim() : null,
      fecha_membresia: formData.fecha_membresia,
      servicios: formData.servicios
    };

    try {
      if (formData.id) {
        const { error } = await supabase
          .from('clientes')
          .update(datosAEnviar)
          .eq('id', formData.id);

        if (error) throw error;

        setClienteSeleccionado(null);
        cargarClientes();
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([datosAEnviar]);

        if (error) throw error;

        setModalNuevo(false);
        setFormData({
          nombre_apellido: '',
          fecha_nacimiento: '',
          telefono: '',
          fecha_membresia: '',
          servicios: []
        });
        cargarClientes();
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert(`Error al guardar: ${error.message}`);
    }
  };

  const eliminarCliente = async (id) => {
    if (confirm('¿Seguro de eliminar este cliente?')) {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (!error) {
        setClienteSeleccionado(null);
        cargarClientes();
      }
    }
  };

  // --- FUNCIONES PARA DESCARGAR Y COMPARTIR QR ---

  // Convertir SVG a Canvas y generar PNG con fondo blanco
  const generarCanvasPNG = () => {
    return new Promise((resolve) => {
      const svgElement = document.getElementById('qr-code-svg');
      if (!svgElement) return resolve(null);

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const padding = 20;
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);

        resolve(canvas);
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  // 1. Descargar QR
  const descargarQR = async () => {
    const canvas = await generarCanvasPNG();
    if (!canvas) return;

    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_${clienteSeleccionado.nombre_apellido.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // 2. Compartir por WhatsApp
  const compartirWhatsApp = async () => {
    if (!clienteSeleccionado) return;

    const telefonoLimpio = clienteSeleccionado.telefono 
      ? clienteSeleccionado.telefono.replace(/\D/g, '') 
      : '';

    const mensajeText = `¡Hola ${clienteSeleccionado.nombre_apellido}! 👋\nAquí tienes tu pase QR de Volcano Fitness 🌋.\nVencimiento de membresía: ${clienteSeleccionado.fecha_membresia}`;

    // Si está en móvil y soporta compartir archivos nativos
    if (navigator.canShare && navigator.share) {
      try {
        const canvas = await generarCanvasPNG();
        if (canvas) {
          canvas.toBlob(async (blob) => {
            if (blob) {
              const file = new File([blob], `QR_${clienteSeleccionado.nombre_apellido}.png`, { type: 'image/png' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: 'Código QR - Volcano Fitness',
                  text: mensajeText,
                });
                return;
              }
            }
            abrirWhatsAppWeb(telefonoLimpio, mensajeText);
          }, 'image/png');
          return;
        }
      } catch (err) {
        console.log('Compartir cancelado o no soportado:', err);
      }
    }

    // Fallback: Abrir chat de WhatsApp
    abrirWhatsAppWeb(telefonoLimpio, mensajeText);
  };

  const abrirWhatsAppWeb = (telefono, mensaje) => {
    const url = telefono 
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // Filtros
  const clientesFiltrados = clientes.filter(cliente => {
    const estado = obtenerEstado(cliente.fecha_membresia);
    const coincideNombre = cliente.nombre_apellido.toLowerCase().includes(busqueda.toLowerCase());
    const coincideServicio = filtroServicio === 'todos' || cliente.servicios?.includes(filtroServicio);
    const coincideEstado = filtroEstado === 'todos' || estado === filtroEstado;

    return coincideNombre && coincideServicio && coincideEstado;
  });

  // Escáner QR
  useEffect(() => {
    let scanner = null;
    if (modalScanner) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        const clienteEncontrado = clientes.find(c => c.id === decodedText);
        if (clienteEncontrado) {
          scanner.clear();
          setModalScanner(false);
          setClienteSeleccionado(clienteEncontrado);
          setFormData(clienteEncontrado);
        } else {
          alert('Código QR no corresponde a ningún cliente registrado.');
        }
      }, () => {});
    }
    return () => {
      if (scanner) scanner.clear().catch(() => {});
    };
  }, [modalScanner, clientes]);

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="logo-container">
          <img src={logoImg} alt="Volcano Fitness Logo" className="logo-img" />
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          {errorMessage && <p className="error-badge">{errorMessage}</p>}
          
          <div className="form-group">
            <label>Usuario</label>
            <input 
              type="text" 
              className="login-input" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              className="login-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="login-btn">Ingresar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* HEADER */}
      <div className="search-header">
        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
          />
          <Search size={22} color="#555" />
        </div>
        
        <button 
          className="qr-scan-btn" 
          onClick={() => setModalScanner(true)}
          title="Escanear QR"
        >
          <QrCode size={32} />
        </button>

        <button 
          className="logout-btn" 
          onClick={handleLogout}
          title="Cerrar Sesión"
        >
          <LogOut size={28} />
        </button>
      </div>

      {/* FILTROS */}
      <div className="filters-container">
        <select 
          className="filter-select" 
          value={filtroServicio} 
          onChange={(e) => setFiltroServicio(e.target.value)}
        >
          <option value="todos">Todos los servicios</option>
          <option value="Gym">Gym</option>
          <option value="Box">Box</option>
        </select>

        <select 
          className="filter-select" 
          value={filtroEstado} 
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activa">Activa (Verde)</option>
          <option value="por-vencer">Casi por caducar (Naranja)</option>
          <option value="caducada">Caducada (Rojo)</option>
        </select>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="client-list">
        {clientesFiltrados.map((cliente) => {
          const estado = obtenerEstado(cliente.fecha_membresia);
          return (
            <button 
              key={cliente.id} 
              className={`client-card status-${estado}`}
              onClick={() => {
                setClienteSeleccionado(cliente);
                setFormData(cliente);
              }}
            >
              <span>{cliente.nombre_apellido}</span>
              <div className="service-badges">
                {cliente.servicios?.map((s, idx) => (
                  <span key={idx} className="badge">{s}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* BOTÓN FLOTANTE NUEVO */}
      <button 
        className="fab-btn" 
        onClick={() => {
          setFormData({
            nombre_apellido: '',
            fecha_nacimiento: '',
            telefono: '',
            fecha_membresia: '',
            servicios: ['Gym']
          });
          setModalNuevo(true);
        }}
      >
        <Plus size={36} />
      </button>

      {/* MODAL DETALLE Y QR */}
      {clienteSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Detalles del Cliente</h2>
              <button className="qr-scan-btn" onClick={() => setClienteSeleccionado(null)}>
                <X size={24} />
              </button>
            </div>

            {/* SECCIÓN QR CON BOTONES DE EXPORTAR Y COMPARTIR */}
            <div className="qr-container">
              <QRCodeSVG id="qr-code-svg" value={clienteSeleccionado.id} size={140} />
              
              <div className="qr-actions">
                <button 
                  type="button" 
                  className="btn-qr-action btn-download" 
                  onClick={descargarQR}
                >
                  <Download size={18} /> Descargar
                </button>
                <button 
                  type="button" 
                  className="btn-qr-action btn-whatsapp" 
                  onClick={compartirWhatsApp}
                >
                  <MessageCircle size={18} /> WhatsApp
                </button>
              </div>
            </div>

            <form className="modal-body" onSubmit={guardarCliente}>
              <label>Nombre y Apellido *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.nombre_apellido} 
                onChange={(e) => setFormData({...formData, nombre_apellido: e.target.value})}
                required 
              />

              <label>Fecha de Nacimiento</label>
              <input 
                type="date" 
                className="input-field" 
                value={formData.fecha_nacimiento || ''} 
                onChange={(e) => setFormData({...formData, fecha_nacimiento: e.target.value})}
              />

              <label>Número de Teléfono</label>
              <input 
                type="tel" 
                className="input-field" 
                value={formData.telefono || ''} 
                onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                placeholder="Ej. +593987654321"
              />

              <label>Vencimiento de Membresía *</label>
              <input 
                type="date" 
                className="input-field" 
                value={formData.fecha_membresia} 
                onChange={(e) => setFormData({...formData, fecha_membresia: e.target.value})}
                required 
              />

              <label>Servicios (1 o 2)</label>
              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={formData.servicios.includes('Gym')} 
                    onChange={() => handleCheckboxChange('Gym')} 
                  /> Gym
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={formData.servicios.includes('Box')} 
                    onChange={() => handleCheckboxChange('Box')} 
                  /> Box
                </label>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                Actualizar Cliente
              </button>
              <button 
                type="button" 
                className="btn-danger" 
                onClick={() => eliminarCliente(clienteSeleccionado.id)}
              >
                Eliminar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO */}
      {modalNuevo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Nuevo Cliente</h2>
              <button className="qr-scan-btn" onClick={() => setModalNuevo(false)}>
                <X size={24} />
              </button>
            </div>
            <form className="modal-body" onSubmit={guardarCliente}>
              <label>Nombre y Apellido *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.nombre_apellido} 
                onChange={(e) => setFormData({...formData, nombre_apellido: e.target.value})}
                required 
              />

              <label>Fecha de Nacimiento</label>
              <input 
                type="date" 
                className="input-field" 
                value={formData.fecha_nacimiento} 
                onChange={(e) => setFormData({...formData, fecha_nacimiento: e.target.value})}
              />

              <label>Número de Teléfono</label>
              <input 
                type="tel" 
                className="input-field" 
                value={formData.telefono} 
                onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                placeholder="Ej. +593987654321"
              />

              <label>Vencimiento de Membresía *</label>
              <input 
                type="date" 
                className="input-field" 
                value={formData.fecha_membresia} 
                onChange={(e) => setFormData({...formData, fecha_membresia: e.target.value})}
                required 
              />

              <label>Servicios</label>
              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={formData.servicios.includes('Gym')} 
                    onChange={() => handleCheckboxChange('Gym')} 
                  /> Gym
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={formData.servicios.includes('Box')} 
                    onChange={() => handleCheckboxChange('Box')} 
                  /> Box
                </label>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '15px' }}>
                Guardar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER QR */}
      {modalScanner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Escanear Código QR</h2>
              <button className="qr-scan-btn" onClick={() => setModalScanner(false)}>
                <X size={24} />
              </button>
            </div>
            <div id="reader" style={{ width: '100%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}