// importando as bibliotecas para poder usar o mapa
// MapContainer - Container do mapa(caixa); TileLayer - Imagens das ruas para compor o mapa
// Marker - É o pino azul que aparece no mapa; Popup - É o texto que aparece no ao clicar no ponto azul
// Polyline - Desenha as linhas no mapa;
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
// useEffect - Um gatilho, se ocorrer X, faça Y; useState - guarda o estado de uma variável
import { useEffect, useState } from "react";
// Garante o arquivo CSS do mapa, sem ele o mapa fica feio e quebrado
import "leaflet/dist/leaflet.css";

// ---- COMPONENTE DAS CURVAS ----
// Missão dessa função é receber uma pilha de coordenadas, requisitar ao servidor OSRM como ir de um ponto ao outro pelas ruas certas e desenhar a linha
const RotaComCurvas = ({ pontos }: { pontos: [number, number][] }) => { // Recebe as coordenadas das paradadas do caminhão
  // Memória que vai guardar os centenas de pontos que formas as curvas das ruas 
  const [coordenadasRota, setCoordenadasRota] = useState<[number, number][]>([]);

  // Esse trecho é acionado toda vez que os pontos das rotas mudam;
  useEffect(() => {
    // Adicionado o AbortController para evitar bloqueio da API por requisições duplas do React
    // Se o user clicar varias vezes em desenhar rotas, o abort só deixa passar a primeira para evitar conflito na API
    const abortController = new AbortController();

    // Como o servidor é gringo, ele exige a ordem contrária das coordenadas('lati,long' passa a ser 'long,lati')
    const coordenadasString = pontos
      .map((ponto) => `${ponto[1]},${ponto[0]}`) // Inverte a ordem de cada uma
      .join(";"); // Junta elas e as separa por ';' resultando em um grande Array de Coordenadas

    // Monta a URL colocando nossa lista de coordenadas no meio
    const url = `https://router.project-osrm.org/route/v1/driving/${coordenadasString}?overview=full&geometries=geojson`;

    // Faz a requisição ao servidor sobre a rota
    fetch(url, { signal: abortController.signal })
      .then((resposta) => resposta.json()) // PEga a resposta do servidor e transforma em JSON, um formato lido pelo JS

      // Vamos tratar a resposta:
      .then((dados) => {
        // Se ela existir (dados.routes), então pegamos a lista de curvas (geometry.coordinates)
        if (dados.routes && dados.routes.length > 0) {
          const coordenadasGeoJson = dados.routes[0].geometry.coordinates;

          // Aqui nós invertemos novamente as coordenadas para o nosso padrão convencional
          const coordenadasLeaflet = coordenadasGeoJson.map((coord: [number, number]) => [
            coord[1],
            coord[0],
          ]);
          setCoordenadasRota(coordenadasLeaflet);
        }
      })
      // Aqui, se houver erro na requisição ou resposta, o código cairá aqui
      .catch((erro) => {
        if (erro.name === "AbortError") return;
        console.error("Erro ao buscar rota: ", erro);
      });

    return () => abortController.abort();
  }, [pontos]);

  // Se houver rotas, ele desenha conforme o estilo pré-definido. Caso não, ele não retorna nada 'return null'
  if (coordenadasRota.length === 0) return null;
  return <Polyline positions={coordenadasRota} color="blue" weight={6} opacity={0.8} />;
};

// ---- COMPONENTE PRINCIPAL, O DO MAPA ---- 
const Mapa = () => {
  // Criamos uma lista de texto para guardar o nome das ruas, há dois espaços vazios para a rua inicial e a rua final
  const [ruas, setRuas] = useState<string[]>(["", ""]);
  // Lista para guardar as coordenadas das ruas intermediárias
  const [pontosDaRota, setPontosDaRota] = useState<[number, number][]>([]);

  // Pega a lista de ruas e adiciona mais um espaço vazio ao final, para mais uma rua
  const adicionarCampoRua = () => setRuas([...ruas, ""]);
  
  // Vai no campo exato que a pessoa está modificando e atualiza na lista de ruas na ordem correta
  const atualizarTextoRua = (index: number, valor: string) => {
    const novasRuas = [...ruas];
    novasRuas[index] = valor;
    setRuas(novasRuas);
  };

  // Apaga o campo se a pessoa clicar no X vermelho para apagar
  const removerCampoRua = (index: number) => {
    if (ruas.length <= 2) return; // Não deixa ter menos de 2 ruas
    setRuas(ruas.filter((_, i) => i !== index));
  };

  // Essa função recebe o nome da rua
  const buscarCoordenadas = async (endereco: string): Promise<[number, number] | null> => {
    try {
      // Concatenando a cidade para a busca ser precisa. No nosso caso, Belém
      const busca = `${endereco}, Belém, Pará`;

      // Montamos a URL para a API que vai retornar as coord da rua desejada
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busca)}`;
      
      // Aciona a API para obter os pontos certos e depois transforma-os em JSON
      const resposta = await fetch(url);
      const dados = await resposta.json();

      // Se os dados existirem, eles são convertidos em float por conta da vírgula
      if (dados && dados.length > 0) {
        return [parseFloat(dados[0].lat), parseFloat(dados[0].lon)];
      }
      return null; // Retorna nulo se não achar a rua
    } catch (erro) {
      console.error("Erro ao buscar endereço:", erro);
      return null;
    }
  };

  // Função disparada ao clicar no botão de 'Desenhar Rota'
  const handleCriarRota = async () => {
    // Filtra para descartar os campos em branco deixados pelo usuário
    const ruasPreenchidas = ruas.filter(rua => rua.trim() !== "");
    
    // Caso tenha menos de 2 ruas, ele dispara uma mensagem para adicionar mais
    if (ruasPreenchidas.length < 2) {
      alert("Por favor, preencha pelo menos o início e o fim da rota.");
      return;
    }

    // Busca as coordenadas de todas as ruas digitadas ao mesmo tempo para poupar tempo
    const promessasCoordenadas = ruasPreenchidas.map(rua => buscarCoordenadas(rua));
    const resultados = await Promise.all(promessasCoordenadas);

    // Verifica se todas as ruas buscadas foram devolvidas
    const coordenadasValidas = resultados.filter(coord => coord !== null) as [number, number][];

    // Se encontrou todas as ruas no mapa, desenha a rota
    if (coordenadasValidas.length === ruasPreenchidas.length) {
      setPontosDaRota(coordenadasValidas);
    } else {
      alert("Atenção: Algumas ruas não foram encontradas. Tente escrever o nome mais completo.");
    }
  };

  // ---- PARTE VISUAL ----
  return (
    <div className="flex flex-col gap-3.75">
      
      {/* --- PAINEL DE CONTROLE DAS COOPERATIVAS --- */}
      <div className="p-3.75 bg-[#f3f4f6] rounded-lg text-black">

        <section className=" flex justify-between mb-5">
          <h3 className=" text-[#0a3d62d8] font-bold text-[20px]">Definir rotas de coleta</h3>
                   
          <button onClick={adicionarCampoRua} className="bg-[#0a3d62] p-1 pr-5 pl-5 text-[15px] rounded-[5px] font-bold text-[#ffffff] cursor-pointer">
            + Adicionar Rua Intermediária
          </button>
        </section>

        {ruas.map((rua, index) => (
          <div key={index} style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
            <span style={{ width: "80px", fontWeight: "bold" }}>
              {index === 0 ? "Início:" : index === ruas.length - 1 ? "Fim:" : `Rua ${index + 1}:`}
            </span>
            <input 
              type="text" 
              placeholder="Ex: Avenida Almirante Barroso" 
              value={rua}
              onChange={(e) => atualizarTextoRua(index, e.target.value)}
              style={{ padding: "8px", width: "300px", marginRight: "10px" }}
            />
            {ruas.length > 2 && (
              <button onClick={() => removerCampoRua(index)} style={{ padding: "8px", cursor: "pointer", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px" }}>
                X
              </button>
            )}
          </div>
        ))}

        <div style={{ marginTop: "15px" }}>
          <button onClick={handleCriarRota} style={{ padding: "10px 15px", cursor: "pointer", backgroundColor: "#39B241", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}>
            Desenhar Rota no Mapa
          </button>
        </div>
      </div>

      {/* --- MAPA --- */}
      <div style={{ height: "500px", width: "100%"}}>
        <MapContainer
          center={[-1.418972, -48.458581]} // Deixei centrado na sua coordenada original
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%"}}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Renderiza a rota e os pinos apenas se existirem pontos validados */}
          {pontosDaRota.length > 0 && (
            <>
              <RotaComCurvas pontos={pontosDaRota} />
              
              {/* Pino Inicial */}
              <Marker position={pontosDaRota[0]}>
                <Popup>Início da Rota</Popup>
              </Marker>

              {/* Pinos Intermediários (Opcional, mas legal para ver onde ele parou) */}
              {pontosDaRota.slice(1, -1).map((ponto, i) => (
                <Marker key={i} position={ponto}>
                  <Popup>Parada Intermediária {i + 1}</Popup>
                </Marker>
              ))}

              {/* Pino Final */}
              <Marker position={pontosDaRota[pontosDaRota.length - 1]}>
                <Popup>Fim da Rota</Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default Mapa;