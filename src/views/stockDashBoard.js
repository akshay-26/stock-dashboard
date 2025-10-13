import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Link,
  Divider,
} from "@mui/material";

/**
 * Parses each stock block inside the markdown file.
 * Extracts thesis, drivers, catalysts, risks, and news links.
 */
function parseNumber(s) {
    if (!s) return null;
    return parseFloat(String(s).replace(/[$,]/g, ''));
  }
  
  function grabInlineList(block, label) {
    // Matches "**Drivers**:" (or Catalysts/Risks), then collects following "- ..." lines until a blank line or next "**"

    console.log('Grabbing list for label:', block);
    const re = new RegExp(`\\*\\*${label}\\*\\*:\\s*([\\s\\S]*?)(?:\\n\\s*\\n|\\n\\*\\*|\\n##|$)`, 'i');
    const m = block.match(re);

    console.log('Matched list:', m);
    if (!m) return [];
    return m[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.replace(/^-\\s*/, '').trim());
  }
  
  function parseStocks(markdownText) {
    const stocks = [];
    // split on headings like "## TICKER — score 12.34"
    const sections = markdownText.split(/\n##\s+/).slice(1);
  
    for (const sec of sections) {
      const lines = sec.split('\n');
      const header = lines[0] || '';
      const h = header.match(/^([A-Z.\-]+)\s*—\s*score\s*([\d.]+)/); // allow dots like BRK.B
      if (!h) continue;
  
      const ticker = h[1];
      const score = parseNumber(h[2]);
  
      const entry = parseNumber(sec.match(/Entry\s*≈?\s*\**\$?([\d.,]+)/i)?.[1]);
      const stop = parseNumber(sec.match(/Stop\s*\**\$?([\d.,]+)/i)?.[1]);
      const target = parseNumber(sec.match(/Target\s*\**\$?([\d.,]+)/i)?.[1]);
      const shares = parseNumber(sec.match(/Position[^]*?\**(\d+)\**\s*shares/i)?.[1]);
      const invest = parseNumber(sec.match(/\(~\$\s*([\d.,]+)\)/)?.[1]);
  
      // ---- THESIS (two formats) ----
      let thesis = '—', drivers = [], catalysts = [], risks = [];
  
      // Prefer a thesis JSON code block right after "**Thesis**:"
      const thesisJsonAfterLabel = sec.match(/\*\*Thesis\*\*:\s*```json([\s\S]*?)```/i);
      // Or any JSON code block in the section
      const anyJson = sec.match(/```json([\s\S]*?)```/i);
  
      const jsonBlock = thesisJsonAfterLabel?.[1] || anyJson?.[1];
  
      if (jsonBlock) {
        try {
          const obj = JSON.parse(jsonBlock);
          if (typeof obj.thesis === 'string') thesis = obj.thesis.trim();
          if (Array.isArray(obj.drivers)) drivers = obj.drivers;
          if (Array.isArray(obj.catalysts)) catalysts = obj.catalysts;
          if (Array.isArray(obj.risks)) risks = obj.risks;
        } catch (e) {
          // fall back to inline on JSON parse error
        }
      }
  
      // Inline thesis fallback e.g. "**Thesis**: Procter & Gamble ..."
      if (thesis === '—') {
        const th = sec.match(/\*\*?Thesis\*?\*?:\s*([^\n]+)/i);
        if (th) thesis = th[1].trim();
      }
  
      // If drivers/catalysts/risks not filled by JSON, try inline lists:
      if (drivers.length === 0) drivers = grabInlineList(sec, 'Drivers');
      if (catalysts.length === 0) catalysts = grabInlineList(sec, 'Catalysts');
      if (risks.length === 0) risks = grabInlineList(sec, 'Risks');
  
      // News links (numbered list with <url>)
      const news = [...sec.matchAll(/\n\d+\.\s*(.*?)<([^>]+)>/g)].map(m => ({
        title: m[1].trim(),
        url: m[2].trim(),
      }));
  
      stocks.push({
        ticker, score, entry, stop, target, shares, invest,
        thesis, drivers, catalysts, risks, news,
      });
    }
    return stocks;
  }
  

export default function StockDashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const url = "https://api.github.com/repos/akshay-26/stock-agent/contents/hot-stocks-latest.md";

    console.log("Token:", process.env.REACT_APP_GITHUB_TOKEN?.slice(0, 10));

  
    fetch(url, {
        headers: {
          Authorization: `token ${process.env.REACT_APP_GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3.raw"
        }
      })
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`GitHub API error: ${res.status} ${errText}`);
          }
      
          // ✅ Two possible response types:
          // - If you use Accept: raw → returns plain markdown text
          // - If you use Accept: json → returns base64 JSON
          const contentType = res.headers.get("content-type");
      
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            const markdown = atob(data.content);
            return markdown;
          } else {
            return res.text(); // ✅ direct markdown text
          }
        })
        .then((markdown) => {
          setStocks(parseStocks(markdown));
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error loading markdown:", err);
          setLoading(false);
        });      
  }, []);
  

  if (loading) {
    return (
      <Container sx={{ mt: 10, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" mt={2}>
          Loading data...
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 6 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        📊 Hot Stocks Dashboard
      </Typography>
      <TableContainer component={Paper} elevation={3}>
        <Table sx={{ minWidth: 1000 }}>
          <TableHead sx={{ backgroundColor: "#1976d2" }}>
            <TableRow>
              {["Ticker", "Entry", "Stop", "Target", "Shares", "Invest ($)", "Score", "Thesis"].map((head) => (
                <TableCell key={head} sx={{ color: "white", fontWeight: "bold" }}>
                  {head}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {stocks.map((s) => (
              <TableRow
                key={s.ticker}
                hover
                sx={{ "&:hover": { backgroundColor: "#f5f5f5" } }}
              >
                <TableCell sx={{ fontWeight: "bold" }}>{s.ticker}</TableCell>
                <TableCell>{s.entry}</TableCell>
                <TableCell>{s.stop}</TableCell>
                <TableCell>{s.target}</TableCell>
                <TableCell>{s.shares}</TableCell>
                <TableCell>{s.invest}</TableCell>
                <TableCell>{s.score}</TableCell>
                <TableCell
                  sx={{
                    maxWidth: 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#1976d2",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelected(s)}
                >
                  {s.thesis}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Popup with full thesis + details */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selected ? `Thesis — ${selected.ticker}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <>
              <Typography variant="body1" mb={2}>
                {selected.thesis}
              </Typography>

              {selected.drivers.length > 0 && (
                <>
                  <Typography variant="h6">Drivers</Typography>
                  <List dense>
                    {selected.drivers.map((d, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={d} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selected.catalysts.length > 0 && (
                <>
                  <Typography variant="h6">Catalysts</Typography>
                  <List dense>
                    {selected.catalysts.map((c, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={c} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selected.risks.length > 0 && (
                <>
                  <Typography variant="h6">Risks</Typography>
                  <List dense>
                    {selected.risks.map((r, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={r} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selected.news.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6">Recent News</Typography>
                  <List dense>
                    {selected.news.map((n, i) => (
                      <ListItem key={i}>
                        <ListItemText
                          primary={
                            <Link href={n.url} target="_blank" rel="noopener">
                              {n.title}
                            </Link>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
