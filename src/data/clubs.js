// ==========================================================================
// data/clubs.js  -  Base de dados dos clubes (Serie A e Serie B) e nomes
// --------------------------------------------------------------------------
// division: 1 = Serie A, 2 = Serie B. Ao fim de cada temporada os 4 ultimos
// da Serie A trocam de lugar com os 4 primeiros da Serie B.
// strength = forca base (gera o overall dos jogadores).
// budget   = caixa inicial em milhoes (financas reduzidas/realistas).
// ==========================================================================
window.BF = window.BF || {};
BF.data = BF.data || {};

BF.data.CLUBS = [
  // ----------------------- SERIE A -----------------------
  { id:1,  division:1, name:"Flamengo",      short:"FLA", city:"Rio de Janeiro/RJ",     stadium:"Maracana",           color:"#d11f1f", strength:85, budget:190, titles:8 },
  { id:2,  division:1, name:"Palmeiras",     short:"PAL", city:"Sao Paulo/SP",          stadium:"Allianz Parque",     color:"#0b7a3b", strength:84, budget:180, titles:12 },
  { id:3,  division:1, name:"Botafogo",      short:"BOT", city:"Rio de Janeiro/RJ",     stadium:"Nilton Santos",      color:"#222222", strength:80, budget:120, titles:3 },
  { id:4,  division:1, name:"Sao Paulo",     short:"SAO", city:"Sao Paulo/SP",          stadium:"MorumBIS",           color:"#c4122e", strength:81, budget:150, titles:6 },
  { id:5,  division:1, name:"Internacional", short:"INT", city:"Porto Alegre/RS",       stadium:"Beira-Rio",          color:"#c8102e", strength:79, budget:110, titles:3 },
  { id:6,  division:1, name:"Corinthians",   short:"COR", city:"Sao Paulo/SP",          stadium:"Neo Quimica Arena",  color:"#1a1a1a", strength:80, budget:135, titles:7 },
  { id:7,  division:1, name:"Fluminense",    short:"FLU", city:"Rio de Janeiro/RJ",     stadium:"Maracana",           color:"#7a1228", strength:79, budget:105, titles:4 },
  { id:8,  division:1, name:"Atletico-MG",   short:"CAM", city:"Belo Horizonte/MG",     stadium:"Arena MRV",          color:"#111111", strength:81, budget:130, titles:2 },
  { id:9,  division:1, name:"Gremio",        short:"GRE", city:"Porto Alegre/RS",       stadium:"Arena do Gremio",    color:"#1d6cb6", strength:79, budget:110, titles:2 },
  { id:10, division:1, name:"Cruzeiro",      short:"CRU", city:"Belo Horizonte/MG",     stadium:"Mineirao",           color:"#1e4ba3", strength:80, budget:120, titles:4 },
  { id:11, division:1, name:"Bahia",         short:"BAH", city:"Salvador/BA",           stadium:"Arena Fonte Nova",   color:"#1d61c4", strength:78, budget:100, titles:2 },
  { id:12, division:1, name:"Vasco da Gama", short:"VAS", city:"Rio de Janeiro/RJ",     stadium:"Sao Januario",       color:"#1c1c1c", strength:77, budget:95,  titles:4 },
  { id:13, division:1, name:"Fortaleza",     short:"FOR", city:"Fortaleza/CE",          stadium:"Arena Castelao",     color:"#1546a0", strength:77, budget:80,  titles:0 },
  { id:14, division:1, name:"RB Bragantino", short:"RBB", city:"Braganca Paulista/SP",  stadium:"Nabi Abi Chedid",    color:"#b91c1c", strength:77, budget:90,  titles:0 },
  { id:15, division:1, name:"Juventude",     short:"JUV", city:"Caxias do Sul/RS",      stadium:"Alfredo Jaconi",     color:"#0a8a44", strength:72, budget:42,  titles:0 },
  { id:16, division:1, name:"Vitoria",       short:"VIT", city:"Salvador/BA",           stadium:"Barradao",           color:"#c4122e", strength:72, budget:48,  titles:0 },
  { id:17, division:1, name:"Santos",        short:"SAN", city:"Santos/SP",             stadium:"Vila Belmiro",       color:"#6b7280", strength:78, budget:95,  titles:8 },
  { id:18, division:1, name:"Mirassol",      short:"MIR", city:"Mirassol/SP",           stadium:"Campos Maia",        color:"#ca8a04", strength:71, budget:35,  titles:0 },
  { id:19, division:1, name:"Ceara",         short:"CEA", city:"Fortaleza/CE",          stadium:"Arena Castelao",     color:"#101010", strength:74, budget:58,  titles:0 },
  { id:20, division:1, name:"Sport",         short:"SPT", city:"Recife/PE",             stadium:"Ilha do Retiro",     color:"#c4122e", strength:73, budget:55,  titles:1 },

  // ----------------------- SERIE B -----------------------
  { id:21, division:2, name:"Athletico-PR",  short:"CAP", city:"Curitiba/PR",           stadium:"Ligga Arena",        color:"#c4122e", strength:78, budget:70,  titles:0 },
  { id:22, division:2, name:"Coritiba",      short:"CFC", city:"Curitiba/PR",           stadium:"Couto Pereira",      color:"#0a7d3b", strength:72, budget:45,  titles:0 },
  { id:23, division:2, name:"Criciuma",      short:"CRI", city:"Criciuma/SC",           stadium:"Heriberto Hulse",    color:"#f5c518", strength:70, budget:40,  titles:0 },
  { id:24, division:2, name:"America-MG",     short:"AME", city:"Belo Horizonte/MG",     stadium:"Arena Independencia",color:"#0a8a44", strength:71, budget:42,  titles:0 },
  { id:25, division:2, name:"Goias",         short:"GOI", city:"Goiania/GO",            stadium:"Serrinha",           color:"#0a8a44", strength:71, budget:40,  titles:0 },
  { id:26, division:2, name:"Novorizontino", short:"NOV", city:"Novo Horizonte/SP",     stadium:"Jorjao",             color:"#d11f1f", strength:69, budget:30,  titles:0 },
  { id:27, division:2, name:"Ponte Preta",   short:"PON", city:"Campinas/SP",           stadium:"Moises Lucarelli",   color:"#1a1a1a", strength:68, budget:28,  titles:0 },
  { id:28, division:2, name:"Vila Nova",     short:"VLN", city:"Goiania/GO",            stadium:"OBA",                color:"#0a7d3b", strength:68, budget:28,  titles:0 },
  { id:29, division:2, name:"Guarani",       short:"GUA", city:"Campinas/SP",           stadium:"Brinco de Ouro",     color:"#0a8a44", strength:66, budget:25,  titles:0 },
  { id:30, division:2, name:"Chapecoense",   short:"CHA", city:"Chapeco/SC",            stadium:"Arena Conda",        color:"#0a8a44", strength:67, budget:26,  titles:0 },
  { id:31, division:2, name:"Avai",          short:"AVA", city:"Florianopolis/SC",      stadium:"Ressacada",          color:"#1d61c4", strength:67, budget:24,  titles:0 },
  { id:32, division:2, name:"CRB",           short:"CRB", city:"Maceio/AL",             stadium:"Rei Pele",           color:"#c4122e", strength:66, budget:22,  titles:0 },
  { id:33, division:2, name:"Paysandu",      short:"PAY", city:"Belem/PA",              stadium:"Curuzu",             color:"#1d61c4", strength:66, budget:24,  titles:0 },
  { id:34, division:2, name:"Remo",          short:"REM", city:"Belem/PA",              stadium:"Baenao",             color:"#1a1a1a", strength:65, budget:22,  titles:0 },
  { id:35, division:2, name:"Botafogo-SP",   short:"BSP", city:"Ribeirao Preto/SP",     stadium:"Santa Cruz",         color:"#1a1a1a", strength:65, budget:20,  titles:0 },
  { id:36, division:2, name:"Operario-PR",   short:"OPE", city:"Ponta Grossa/PR",       stadium:"Germano Kruger",     color:"#1a1a1a", strength:64, budget:18,  titles:0 },
  { id:37, division:2, name:"Amazonas",      short:"AMA", city:"Manaus/AM",             stadium:"Arena da Amazonia",  color:"#0a8a44", strength:63, budget:14,  titles:0 },
  { id:38, division:2, name:"America-RN",     short:"ARN", city:"Natal/RN",              stadium:"Arena das Dunas",    color:"#c4122e", strength:61, budget:11,  titles:0 },
  { id:39, division:2, name:"Volta Redonda", short:"VRE", city:"Volta Redonda/RJ",      stadium:"Raulino de Oliveira",color:"#1d61c4", strength:61, budget:10,  titles:0 },
  { id:40, division:2, name:"Athletic",      short:"ATH", city:"Sao Joao del-Rei/MG",   stadium:"Joaquim Portugal",   color:"#0a8a44", strength:62, budget:12,  titles:0 }
];

// Clubes usados como adversarios nas copas continentais. Nao aparecem na
// escolha de carreira nem nas divisoes nacionais.
BF.data.CONTINENTAL_CLUBS = [
  { id:101, division:0, name:"River Plate",              short:"RIV", city:"Buenos Aires/ARG",  stadium:"Monumental",          color:"#b91c1c", strength:86, budget:170, titles:4, continental:true },
  { id:102, division:0, name:"Boca Juniors",             short:"BOC", city:"Buenos Aires/ARG",  stadium:"La Bombonera",        color:"#1d4ed8", strength:84, budget:160, titles:6, continental:true },
  { id:103, division:0, name:"Racing",                   short:"RAC", city:"Avellaneda/ARG",    stadium:"El Cilindro",         color:"#38bdf8", strength:81, budget:115, titles:1, continental:true },
  { id:104, division:0, name:"Estudiantes",              short:"EST", city:"La Plata/ARG",      stadium:"Jorge Hirschi",       color:"#dc2626", strength:80, budget:105, titles:4, continental:true },
  { id:105, division:0, name:"Independiente",            short:"IND", city:"Avellaneda/ARG",    stadium:"Libertadores",        color:"#b91c1c", strength:78, budget:95,  titles:7, continental:true },
  { id:106, division:0, name:"Penarol",                  short:"PEN", city:"Montevideo/URU",    stadium:"Campeon del Siglo",   color:"#facc15", strength:80, budget:95,  titles:5, continental:true },
  { id:107, division:0, name:"Nacional-URU",             short:"NAC", city:"Montevideo/URU",    stadium:"Gran Parque Central", color:"#2563eb", strength:79, budget:90,  titles:3, continental:true },
  { id:108, division:0, name:"Olimpia",                  short:"OLI", city:"Assuncao/PAR",      stadium:"Manuel Ferreira",     color:"#111827", strength:78, budget:85,  titles:3, continental:true },
  { id:109, division:0, name:"Cerro Porteno",            short:"CER", city:"Assuncao/PAR",      stadium:"La Nueva Olla",       color:"#1d4ed8", strength:77, budget:80,  titles:0, continental:true },
  { id:110, division:0, name:"Libertad",                 short:"LIB", city:"Assuncao/PAR",      stadium:"La Huerta",           color:"#111827", strength:77, budget:78,  titles:0, continental:true },
  { id:111, division:0, name:"LDU Quito",                short:"LDU", city:"Quito/ECU",         stadium:"Casa Blanca",         color:"#f8fafc", strength:78, budget:82,  titles:1, continental:true },
  { id:112, division:0, name:"Independiente del Valle",  short:"IDV", city:"Sangolqui/ECU",     stadium:"Banco Guayaquil",     color:"#111827", strength:79, budget:90,  titles:0, continental:true },
  { id:113, division:0, name:"Atletico Nacional",        short:"NAL", city:"Medellin/COL",      stadium:"Atanasio Girardot",   color:"#16a34a", strength:80, budget:95,  titles:2, continental:true },
  { id:114, division:0, name:"Millonarios",              short:"MIL", city:"Bogota/COL",        stadium:"El Campin",           color:"#1d4ed8", strength:75, budget:70,  titles:0, continental:true },
  { id:115, division:0, name:"Colo-Colo",                short:"COL", city:"Santiago/CHI",      stadium:"Monumental David",    color:"#111827", strength:78, budget:82,  titles:1, continental:true },
  { id:116, division:0, name:"Universidad de Chile",     short:"UCH", city:"Santiago/CHI",      stadium:"Nacional",            color:"#1d4ed8", strength:74, budget:68,  titles:0, continental:true },
  { id:117, division:0, name:"Alianza Lima",             short:"ALI", city:"Lima/PER",          stadium:"Matute",              color:"#1e3a8a", strength:73, budget:60,  titles:0, continental:true },
  { id:118, division:0, name:"Sporting Cristal",         short:"SCR", city:"Lima/PER",          stadium:"Alberto Gallardo",    color:"#38bdf8", strength:74, budget:62,  titles:0, continental:true },
  { id:119, division:0, name:"Bolivar",                  short:"BOL", city:"La Paz/BOL",        stadium:"Hernando Siles",      color:"#2563eb", strength:76, budget:72,  titles:0, continental:true },
  { id:120, division:0, name:"The Strongest",            short:"STR", city:"La Paz/BOL",        stadium:"Hernando Siles",      color:"#facc15", strength:73, budget:58,  titles:0, continental:true },
  { id:121, division:0, name:"Velez Sarsfield",          short:"VEL", city:"Buenos Aires/ARG",  stadium:"Jose Amalfitani",     color:"#1f2937", strength:79, budget:90,  titles:0, continental:true },
  { id:122, division:0, name:"San Lorenzo",              short:"SLO", city:"Buenos Aires/ARG",  stadium:"Pedro Bidegain",      color:"#b91c1c", strength:77, budget:82,  titles:1, continental:true },
  { id:123, division:0, name:"Lanus",                    short:"LAN", city:"Lanus/ARG",         stadium:"Ciudad de Lanus",     color:"#7f1d1d", strength:76, budget:75,  titles:0, continental:true },
  { id:124, division:0, name:"Banfield",                 short:"BAN", city:"Banfield/ARG",      stadium:"Florencio Sola",      color:"#16a34a", strength:73, budget:60,  titles:0, continental:true },
  { id:125, division:0, name:"Defensa y Justicia",       short:"DEF", city:"Florencio Varela/ARG", stadium:"Norberto Tomaghello",color:"#f59e0b", strength:75, budget:68,  titles:0, continental:true },
  { id:126, division:0, name:"Talleres",                 short:"TAL", city:"Cordoba/ARG",       stadium:"Mario Kempes",        color:"#1e3a8a", strength:77, budget:80,  titles:0, continental:true },
  { id:127, division:0, name:"Argentinos Juniors",       short:"ARG", city:"Buenos Aires/ARG",  stadium:"Diego Maradona",      color:"#dc2626", strength:74, budget:62,  titles:0, continental:true },
  { id:128, division:0, name:"Newell's",                 short:"NOB", city:"Rosario/ARG",       stadium:"Marcelo Bielsa",      color:"#dc2626", strength:75, budget:68,  titles:0, continental:true },
  { id:129, division:0, name:"Rosario Central",          short:"ROS", city:"Rosario/ARG",       stadium:"Gigante de Arroyito", color:"#1d4ed8", strength:75, budget:70,  titles:0, continental:true },
  { id:130, division:0, name:"Huracan",                  short:"HUR", city:"Buenos Aires/ARG",  stadium:"Tomas Duco",          color:"#dc2626", strength:73, budget:58,  titles:0, continental:true },
  { id:131, division:0, name:"Tigre",                    short:"TIG", city:"Victoria/ARG",      stadium:"Jose Dellagiovanna",  color:"#1d4ed8", strength:71, budget:50,  titles:0, continental:true },
  { id:132, division:0, name:"Universidad Catolica",     short:"UCA", city:"Santiago/CHI",      stadium:"San Carlos de Apoquindo", color:"#1e3a8a", strength:76, budget:72,  titles:0, continental:true },
  { id:133, division:0, name:"Audax Italiano",           short:"AUD", city:"Santiago/CHI",      stadium:"Bicentenario La Florida", color:"#16a34a", strength:71, budget:48,  titles:0, continental:true },
  { id:134, division:0, name:"Palestino",                short:"PAL", city:"Santiago/CHI",      stadium:"La Cisterna",         color:"#16a34a", strength:72, budget:52,  titles:0, continental:true },
  { id:135, division:0, name:"Cobresal",                 short:"CBS", city:"El Salvador/CHI",   stadium:"El Cobre",            color:"#f97316", strength:70, budget:45,  titles:0, continental:true },
  { id:136, division:0, name:"Union Espanola",           short:"UES", city:"Santiago/CHI",      stadium:"Santa Laura",         color:"#b91c1c", strength:70, budget:46,  titles:0, continental:true },
  { id:137, division:0, name:"Junior",                   short:"JUN", city:"Barranquilla/COL",  stadium:"Metropolitano",       color:"#dc2626", strength:76, budget:72,  titles:0, continental:true },
  { id:138, division:0, name:"America de Cali",          short:"AME", city:"Cali/COL",          stadium:"Pascual Guerrero",    color:"#dc2626", strength:74, budget:64,  titles:0, continental:true },
  { id:139, division:0, name:"Independiente Santa Fe",   short:"SFE", city:"Bogota/COL",        stadium:"El Campin",           color:"#dc2626", strength:73, budget:60,  titles:0, continental:true },
  { id:140, division:0, name:"Deportes Tolima",          short:"TOL", city:"Ibague/COL",        stadium:"Manuel Murillo Toro", color:"#facc15", strength:73, budget:58,  titles:0, continental:true },
  { id:141, division:0, name:"Once Caldas",              short:"ONC", city:"Manizales/COL",     stadium:"Palogrande",          color:"#f8fafc", strength:72, budget:55,  titles:1, continental:true },
  { id:142, division:0, name:"Defensor Sporting",        short:"DSP", city:"Montevideo/URU",    stadium:"Luis Franzini",       color:"#7c2d12", strength:73, budget:58,  titles:0, continental:true },
  { id:143, division:0, name:"Liverpool-URU",            short:"LVU", city:"Montevideo/URU",    stadium:"Belvedere",           color:"#1d4ed8", strength:73, budget:55,  titles:0, continental:true },
  { id:144, division:0, name:"Danubio",                  short:"DAN", city:"Montevideo/URU",    stadium:"Jardines del Hipodromo", color:"#1e3a8a", strength:71, budget:48,  titles:0, continental:true },
  { id:145, division:0, name:"Guarani-PAR",              short:"GPA", city:"Assuncao/PAR",      stadium:"Rogelio Livieres",    color:"#facc15", strength:73, budget:55,  titles:0, continental:true },
  { id:146, division:0, name:"Sportivo Luqueno",         short:"LUQ", city:"Luque/PAR",         stadium:"Feliciano Caceres",   color:"#1e3a8a", strength:70, budget:42,  titles:0, continental:true },
  { id:147, division:0, name:"General Caballero",        short:"GEN", city:"Mallorquin/PAR",    stadium:"Ka'arendy",           color:"#16a34a", strength:68, budget:36,  titles:0, continental:true },
  { id:148, division:0, name:"Barcelona SC",             short:"BSC", city:"Guayaquil/ECU",     stadium:"Monumental Banco Pichincha", color:"#facc15", strength:76, budget:72,  titles:0, continental:true },
  { id:149, division:0, name:"Emelec",                   short:"EME", city:"Guayaquil/ECU",     stadium:"George Capwell",      color:"#1d4ed8", strength:74, budget:64,  titles:0, continental:true },
  { id:150, division:0, name:"Aucas",                    short:"AUC", city:"Quito/ECU",         stadium:"Gonzalo Pozo Ripalda",color:"#dc2626", strength:72, budget:52,  titles:0, continental:true },
  { id:151, division:0, name:"Universitario",            short:"UNI", city:"Lima/PER",          stadium:"Monumental U",        color:"#7f1d1d", strength:75, budget:68,  titles:0, continental:true },
  { id:152, division:0, name:"Cienciano",                short:"CIE", city:"Cusco/PER",         stadium:"Inca Garcilaso",      color:"#dc2626", strength:71, budget:48,  titles:1, continental:true },
  { id:153, division:0, name:"Melgar",                   short:"MEL", city:"Arequipa/PER",      stadium:"Monumental UNSA",     color:"#7c2d12", strength:72, budget:52,  titles:0, continental:true },
  { id:154, division:0, name:"Caracas",                  short:"CAR", city:"Caracas/VEN",       stadium:"Olimpico UCV",        color:"#dc2626", strength:72, budget:52,  titles:0, continental:true },
  { id:155, division:0, name:"Deportivo Tachira",        short:"TAC", city:"San Cristobal/VEN", stadium:"Pueblo Nuevo",        color:"#facc15", strength:71, budget:48,  titles:0, continental:true },
  { id:156, division:0, name:"Estudiantes de Merida",    short:"EME", city:"Merida/VEN",        stadium:"Metropolitano",       color:"#dc2626", strength:69, budget:40,  titles:0, continental:true },
  { id:157, division:0, name:"Carabobo",                 short:"CAB", city:"Valencia/VEN",      stadium:"Misael Delgado",      color:"#1d4ed8", strength:69, budget:38,  titles:0, continental:true },
  { id:158, division:0, name:"Always Ready",             short:"ALW", city:"La Paz/BOL",        stadium:"Municipal El Alto",   color:"#16a34a", strength:73, budget:55,  titles:0, continental:true },
  { id:159, division:0, name:"Royal Pari",               short:"RPA", city:"Santa Cruz/BOL",    stadium:"Tahuichi Aguilera",   color:"#16a34a", strength:69, budget:40,  titles:0, continental:true },
  { id:160, division:0, name:"Oriente Petrolero",        short:"ORI", city:"Santa Cruz/BOL",    stadium:"Tahuichi Aguilera",   color:"#16a34a", strength:70, budget:44,  titles:0, continental:true }
];

BF.data.FIRST = ["Gabriel","Lucas","Joao","Pedro","Matheus","Bruno","Rafael","Diego","Thiago","Felipe","Vinicius","Carlos","Rodrigo","Marcos","Andre","Wesley","Igor","Renato","Caio","Leo","Yuri","Daniel","Everton","Paulo","Murilo","Hugo","Arthur","Davi","Kaio","Luan","Otavio","Bernardo","Gustavo","Richard","Nathan","Alan","Breno","Caua","Emerson","Juninho","Rony","Endrick","Vitor","Wanderson","Jardel","Cleber"];
BF.data.LAST = ["Silva","Santos","Oliveira","Souza","Pereira","Costa","Almeida","Ferreira","Rodrigues","Gomes","Martins","Barbosa","Ribeiro","Carvalho","Araujo","Lima","Moura","Nascimento","Cardoso","Teixeira","Rocha","Dias","Moraes","Nunes","Mendes","Freitas","Cunha","Pinto","Ramos","Vieira","Lopes","Correia","Macedo","Tavares","Borges","Camargo"];

// Formacao base usada para gerar o elenco: [posicao, quantidade]
BF.data.FORMATION = [["GOL",2],["ZAG",4],["LAT",3],["VOL",3],["MEI",4],["ATA",4]];
BF.data.POS_ORDER = ["GOL","ZAG","LAT","VOL","MEI","ATA"];
// XI titular ideal (11): usado para auto-escalacao e validacao
BF.data.LINEUP_NEED = { GOL:1, ZAG:2, LAT:2, VOL:2, MEI:2, ATA:2 };
// Cada formacao e descrita por LINHAS (do gol ao ataque). O mapa do campo na
// aba Escalacao e desenhado a partir destas linhas, entao o layout sempre
// corresponde a formacao escolhida. slots/need sao derivados das linhas.
BF.data.FORMATIONS = {
  "4-4-2":   { label:"4-4-2",   lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["MEI","VOL","VOL","MEI"],["ATA","ATA"]] },
  "4-3-3":   { label:"4-3-3",   lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["VOL","MEI","MEI"],["ATA","ATA","ATA"]] },
  "3-5-2":   { label:"3-5-2",   lines:[["GOL"],["ZAG","ZAG","ZAG"],["VOL","MEI","MEI","MEI","VOL"],["ATA","ATA"]] },
  "4-2-3-1": { label:"4-2-3-1", lines:[["GOL"],["LAT","ZAG","ZAG","LAT"],["VOL","VOL"],["MEI","MEI","MEI"],["ATA"]] },
  "5-3-2":   { label:"5-3-2",   lines:[["GOL"],["LAT","ZAG","ZAG","ZAG","LAT"],["VOL","MEI","VOL"],["ATA","ATA"]] }
};
// Deriva slots (lista achatada) e need (contagem por posicao) de cada formacao.
Object.keys(BF.data.FORMATIONS).forEach(function (k) {
  var f = BF.data.FORMATIONS[k];
  f.slots = [].concat.apply([], f.lines);
  f.need = {}; BF.data.POS_ORDER.forEach(function (p) { f.need[p] = 0; });
  f.slots.forEach(function (p) { f.need[p] = (f.need[p] || 0) + 1; });
});

// Base opcional para elencos reais. O gerador usa estes nomes primeiro e
// completa as vagas restantes automaticamente.
BF.data.REAL_PLAYERS = {
  1: { GOL:["Rossi"], ZAG:["Léo Pereira","Léo Ortiz"], LAT:["Varela","Ayrton Lucas"], VOL:["Pulgar","Allan"], MEI:["Arrascaeta","De la Cruz"], ATA:["Bruno Henrique","Pedro","Luiz Araújo"] },
  2: { GOL:["Weverton"], ZAG:["Gómez","Murilo"], LAT:["Piquerez","Mayke"], VOL:["Aníbal Moreno","Zé Rafael"], MEI:["Raphael Veiga","Maurício"], ATA:["Estêvão","Rony"] },
  3: { GOL:["John"], ZAG:["Bastos","Alexander Barboza"], LAT:["Marçal"], VOL:["Marlon Freitas","Gregore"], MEI:["Eduardo"], ATA:["Jeffinho","Tiquinho Soares"] },
  4: { GOL:["Rafael"], ZAG:["Arboleda","Alan Franco"], LAT:["Rafinha","Welington"], VOL:["Pablo Maia","Alisson"], MEI:["Luciano","Lucas Moura"], ATA:["Calleri"] },
  6: { GOL:["Hugo Souza"], ZAG:["Gustavo Henrique","Félix Torres"], LAT:["Matheuzinho"], VOL:["Raniele","Maycon"], MEI:["Rodrigo Garro"], ATA:["Yuri Alberto","Memphis Depay"] },
  17:{ GOL:["Gabriel Brazão"], ZAG:["Gil"], LAT:["Escobar"], VOL:["João Schmidt"], MEI:["Soteldo"], ATA:["Guilherme"] }
};
