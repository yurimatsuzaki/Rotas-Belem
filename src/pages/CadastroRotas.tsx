import Mapa from "../components/Mapa";

const CadastroRotas = () => {
  return (
    <div className="h-full bg-[#E9E9E9]">
      <header className="bg-[#39B241] h-8 w-full"></header>

      <div className=" flex flex-col items-center p-2">
        <main className="bg-[#ffffff] max-w-200 min-h-200 p-5 mt-5 rounded-xl">
          <section className="flex justify-between p-3">
            <h1 className="text-[#0A3D62] font-extrabold text-[35px] mb-2 text-left w-[65%]">
              Cadastro de Rotas de coleta
            </h1>
            <div className="w-20 h-1"></div>
          </section>

          <Mapa />
        </main>
      </div>
    </div>
  );
};

export default CadastroRotas;
