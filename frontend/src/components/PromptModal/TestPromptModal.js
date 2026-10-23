import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography
} from "@material-ui/core";
import { Close, Send, DeleteSweep, AssistantOutlined, Person } from "@material-ui/icons";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === "dark";

  return {
    dialogTitle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(2, 2.5)
    },
    titleText: {
      fontWeight: 700,
      fontSize: "1.05rem"
    },
    helpText: {
      fontSize: "0.76rem",
      color: isDark ? "#94a3b8" : "#64748b",
      lineHeight: 1.5,
      padding: theme.spacing(0, 0.5, 1.5)
    },
    chatBox: {
      height: 420,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: theme.spacing(1, 0.5),
      backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.015)",
      borderRadius: 10,
      border: `1px solid ${theme.palette.divider}`
    },
    emptyState: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.82rem",
      color: isDark ? "#64748b" : "#94a3b8",
      textAlign: "center",
      padding: theme.spacing(2)
    },
    row: {
      display: "flex",
      gap: 8,
      alignItems: "flex-start"
    },
    rowUser: {
      flexDirection: "row-reverse"
    },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    },
    avatarAssistant: {
      backgroundColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)",
      color: isDark ? "#818cf8" : "#4f46e5"
    },
    avatarUser: {
      backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.12)",
      color: "#16a34a"
    },
    bubble: {
      maxWidth: "75%",
      padding: "8px 12px",
      borderRadius: 12,
      fontSize: "0.84rem",
      lineHeight: 1.45,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    bubbleAssistant: {
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#fff",
      border: `1px solid ${theme.palette.divider}`,
      color: isDark ? "#e2e8f0" : "#0f172a"
    },
    bubbleUser: {
      backgroundColor: isDark ? "rgba(99,102,241,0.25)" : "#4f46e5",
      color: isDark ? "#e0e7ff" : "#fff"
    },
    inputRow: {
      display: "flex",
      gap: 8,
      marginTop: 12,
      alignItems: "flex-end"
    }
  };
});

const TestPromptModal = ({ open, onClose, prompt }) => {
  const classes = useStyles();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, prompt?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !prompt?.id) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post(`/prompt/${prompt.id}/test`, {
        message: text,
        history
      });
      setMessages(current => [...current, { role: "assistant", content: data.reply }]);
    } catch (err) {
      toastError(err);
      setMessages(current => current.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    toast.info("Conversa de teste limpa.");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Typography className={classes.titleText}>
          Testar agente {prompt?.name ? `— ${prompt.name}` : ""}
        </Typography>
        <Box display="flex" alignItems="center" gap={4}>
          <IconButton size="small" onClick={handleClear} title="Limpar conversa">
            <DeleteSweep fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography className={classes.helpText}>
          Chat de teste interno — simula a personalidade e as instruções do
          agente, mas não envia nada pelo WhatsApp e não reproduz 100% do
          comportamento real (divisão de mensagens, envio de arquivo do
          catálogo etc).
        </Typography>

        <div className={classes.chatBox} ref={scrollRef}>
          {messages.length === 0 ? (
            <div className={classes.emptyState}>
              Manda uma mensagem pra começar a testar o agente.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`${classes.row} ${m.role === "user" ? classes.rowUser : ""}`}
              >
                <div
                  className={`${classes.avatar} ${
                    m.role === "user" ? classes.avatarUser : classes.avatarAssistant
                  }`}
                >
                  {m.role === "user" ? (
                    <Person style={{ fontSize: 16 }} />
                  ) : (
                    <AssistantOutlined style={{ fontSize: 16 }} />
                  )}
                </div>
                <div
                  className={`${classes.bubble} ${
                    m.role === "user" ? classes.bubbleUser : classes.bubbleAssistant
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className={classes.row}>
              <div className={`${classes.avatar} ${classes.avatarAssistant}`}>
                <AssistantOutlined style={{ fontSize: 16 }} />
              </div>
              <div className={`${classes.bubble} ${classes.bubbleAssistant}`}>
                <CircularProgress size={14} />
              </div>
            </div>
          )}
        </div>

        <div className={classes.inputRow}>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder="Digite como se fosse o cliente..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{ minWidth: 44, height: 40 }}
          >
            <Send style={{ fontSize: 18 }} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TestPromptModal;
