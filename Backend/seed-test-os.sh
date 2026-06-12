#!/bin/bash
set -e

API="http://localhost:3001/v1"

# Login
TOKEN=$(curl -s "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"guidortas25@gmail.com","password":"180525"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

echo "✅ Token obtido"

# --- Criar Serviços ---
echo "📋 Criando serviços..."
SVC1=$(curl -s "$API/services" -H "$AUTH" -H "$CT" -d '{
  "name": "Torneamento CNC",
  "description": "Torneamento de peças em torno CNC com precisão de 0.01mm",
  "price": 250.00
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Serviço 1 (Torneamento CNC): ID=$SVC1"

SVC2=$(curl -s "$API/services" -H "$AUTH" -H "$CT" -d '{
  "name": "Soldagem MIG/MAG",
  "description": "Soldagem MIG/MAG em aço carbono e inox",
  "price": 180.00
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Serviço 2 (Soldagem MIG/MAG): ID=$SVC2"

SVC3=$(curl -s "$API/services" -H "$AUTH" -H "$CT" -d '{
  "name": "Retífica Cilíndrica",
  "description": "Retífica cilíndrica de eixos e virabrequins",
  "price": 320.00
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Serviço 3 (Retífica Cilíndrica): ID=$SVC3"

# --- Criar Materiais ---
echo "🔩 Criando materiais..."
MAT1=$(curl -s "$API/materials" -H "$AUTH" -H "$CT" -d '{
  "name": "Barra de Aço SAE 1045",
  "unit": "kg",
  "price": 18.50,
  "stock": 500
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Material 1 (Barra Aço SAE 1045): ID=$MAT1"

MAT2=$(curl -s "$API/materials" -H "$AUTH" -H "$CT" -d '{
  "name": "Eletrodo Revestido E7018",
  "unit": "un",
  "price": 4.20,
  "stock": 1000
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Material 2 (Eletrodo E7018): ID=$MAT2"

MAT3=$(curl -s "$API/materials" -H "$AUTH" -H "$CT" -d '{
  "name": "Rolamento 6205-2RS",
  "unit": "un",
  "price": 42.00,
  "stock": 200
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Material 3 (Rolamento 6205-2RS): ID=$MAT3"

# --- Criar Funcionário ---
echo "👷 Criando funcionário..."
# Primeiro criar a pessoa
PERSON2=$(curl -s "$API/people" -H "$AUTH" -H "$CT" -d '{
  "type": "NATURAL",
  "naturalPerson": {"name": "Carlos Eduardo Silva", "cpf": "12345678901"}
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Pessoa (Carlos Eduardo): ID=$PERSON2"

EMP1=$(curl -s "$API/employees" -H "$AUTH" -H "$CT" -d "{
  \"personId\": $PERSON2,
  \"role\": \"Torneiro Mecânico\",
  \"department\": \"Usinagem\",
  \"status\": \"ACTIVE\"
}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo "  Funcionário (Carlos Eduardo): ID=$EMP1"

# --- Criar Ordem de Serviço ---
echo "📄 Criando Ordem de Serviço..."
OS=$(curl -s "$API/service-orders" -H "$AUTH" -H "$CT" -d "{
  \"personId\": 1,
  \"description\": \"Recuperação de Eixo de Transmissão - Motor WEG W22 150cv\",
  \"status\": \"Em Andamento\",
  \"openingDate\": \"2026-06-10\",
  \"workCenter\": \"Oficina Central\",
  \"plannedStartDate\": \"2026-06-11\",
  \"plannedEndDate\": \"2026-06-18\",
  \"plannedHours\": 24,
  \"problemDescription\": \"Eixo de transmissão do motor WEG W22 de 150cv apresenta desgaste excessivo no mancal, vibração anormal e aquecimento acima de 85°C. Cliente relata ruído metálico intermitente durante operação em carga plena. Necessário usinagem de recuperação, troca de rolamentos e balanceamento dinâmico.\",
  \"technicalDiagnosis\": \"Após inspeção visual e dimensional, constatou-se desgaste de 0.15mm no diâmetro do mancal principal. Rolamentos apresentam folga excessiva e marcas de brinelamento. Recomenda-se torneamento para recuperação dimensional, metalização da superfície, retífica final e substituição dos rolamentos.\",
  \"profitPercent\": 15,
  \"taxPercent\": 8.5,
  \"services\": [
    {\"serviceId\": $SVC1, \"employeeId\": $EMP1, \"hoursWorked\": 8, \"unitPrice\": 250.00, \"totalPrice\": 2000.00},
    {\"serviceId\": $SVC2, \"employeeId\": $EMP1, \"hoursWorked\": 4, \"unitPrice\": 180.00, \"totalPrice\": 720.00},
    {\"serviceId\": $SVC3, \"employeeId\": $EMP1, \"hoursWorked\": 6, \"unitPrice\": 320.00, \"totalPrice\": 1920.00}
  ],
  \"materials\": [
    {\"materialId\": $MAT1, \"quantity\": 12, \"unitPrice\": 18.50, \"totalPrice\": 222.00},
    {\"materialId\": $MAT2, \"quantity\": 30, \"unitPrice\": 4.20, \"totalPrice\": 126.00},
    {\"materialId\": $MAT3, \"quantity\": 2, \"unitPrice\": 42.00, \"totalPrice\": 84.00}
  ]
}")
echo "Resposta OS: $OS"
OS_ID=$(echo "$OS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
echo ""
echo "🎉 Ordem de Serviço criada com sucesso! ID=$OS_ID"
echo "   → 3 serviços (Torneamento, Soldagem, Retífica)"
echo "   → 3 materiais (Barra Aço, Eletrodo, Rolamento)"
echo "   → Custo direto: R$ 5.072,00"
echo "   → Lucro (15%): R$ 760,80"
echo "   → Impostos (8.5%): R$ 495,79"
echo "   → Total: R$ 6.328,59"
echo ""
echo "🖨️  Teste o PDF em: http://localhost:3001/v1/service-orders/$OS_ID/pdf"
